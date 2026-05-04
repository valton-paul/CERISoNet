import { Router, type Request } from 'express';
import type { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import { store } from '../../database/mongodb';
import { getPostgres } from '../../database/postgres';
import config from '../../config/config';

const postsRouter = Router();

type PostAuthor = {
  id: number;
  pseudo: string;
  mail: string;
};

type WithCreatedBy = { createdBy?: unknown };

/** Jointure logique createdBy → fredouil.compte.id (un seul aller-retour SQL). */
async function enrichPostsWithAuthors<T extends WithCreatedBy>(
  posts: T[],
): Promise<Array<T & { author: PostAuthor | null }>> {
  const ids = [
    ...new Set(
      posts
        .map((p) => p.createdBy)
        .filter((id): id is number => typeof id === 'number' && Number.isInteger(id)),
    ),
  ];

  if (ids.length === 0) {
    return posts.map((p) => ({ ...p, author: null }));
  }

  const pool = getPostgres();
  const { rows } = await pool.query<PostAuthor>(
    `SELECT id, pseudo, mail FROM fredouil.compte WHERE id = ANY($1::int[])`,
    [ids],
  );

  const byId = new Map<number, PostAuthor>(
    rows.map((r) => [r.id, { id: r.id, pseudo: String(r.pseudo ?? ''), mail: String(r.mail ?? '') }]),
  );

  return posts.map((p) => {
    const id = p.createdBy;
    const author =
      typeof id === 'number' && Number.isInteger(id) ? (byId.get(id) ?? null) : null;
    return { ...p, author };
  });
}

const MAX_BODY_LENGTH = 5000;
const MAX_COMMENT_LENGTH = 2000;

function parseObjectId(id: string): ObjectId | null {
  if (!id || !ObjectId.isValid(id)) {
    return null;
  }
  return new ObjectId(id);
}

function getIo(req: Request): Server | undefined {
  return req.app.get('io') as Server | undefined;
}

function normalizeLikedBy(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((x): x is number => typeof x === 'number' && Number.isInteger(x));
}

type MongoPostDoc = {
  _id: ObjectId;
  likedBy?: unknown;
  likes?: unknown;
  body?: unknown;
  date?: unknown;
  hour?: unknown;
  createdBy?: unknown;
  hashtags?: unknown;
  comments?: unknown;
  shared?: unknown;
  images?: unknown;
};

/** Post JSON pour le client (sans exposer le tableau `likedBy`). */
function shapePostFromMongo(d: MongoPostDoc, viewerId?: number) {
  const lb = normalizeLikedBy(d.likedBy);
  const likes = typeof d.likes === 'number' && Number.isFinite(d.likes) ? d.likes : 0;
  return {
    _id: d._id.toString(),
    body: typeof d.body === 'string' ? d.body : '',
    date: typeof d.date === 'string' ? d.date : '',
    hour: typeof d.hour === 'string' ? d.hour : '',
    createdBy: d.createdBy,
    likes,
    hashtags: Array.isArray(d.hashtags) ? d.hashtags : [],
    comments: serializeCommentIds(d.comments),
    shared: d.shared != null ? String(d.shared) : undefined,
    images: d.images,
    likedByMe:
      typeof viewerId === 'number' && Number.isInteger(viewerId) && lb.includes(viewerId),
  };
}

/** Sérialise les `_id` des sous-documents pour `res.json` (évite `{ $oid: … }` côté client). */
function serializeCommentIds(comments: unknown): unknown[] {
  if (!Array.isArray(comments)) {
    return [];
  }
  return comments.map((c) => {
    if (!c || typeof c !== 'object') {
      return c;
    }
    const o = { ...(c as Record<string, unknown>) };
    const id = o['_id'];
    if (id instanceof ObjectId) {
      o['_id'] = id.toHexString();
    } else if (id != null && typeof id === 'object' && '$oid' in (id as Record<string, unknown>)) {
      o['_id'] = String((id as { $oid: string }).$oid);
    } else if (id != null) {
      o['_id'] = String(id);
    }
    return o;
  });
}

function formatParisDateParts(): { date: string; hour: string } {
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hour = now.toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  });
  return { date, hour };
}

postsRouter.post('/', async (req, res) => {
  const s = req.session as { isConnected?: boolean; userId?: number };
  if (!s.isConnected || s.userId == null) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  const rawBody = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!rawBody) {
    return res.status(400).json({ error: 'Le texte de la publication est requis' });
  }
  if (rawBody.length > MAX_BODY_LENGTH) {
    return res
      .status(400)
      .json({ error: `Publication trop longue (${MAX_BODY_LENGTH} caractères max)` });
  }

  try {
    const { database = 'db-CERI', postsCollection = 'CERISoNet' } = config.databases.mongodb;
    const coll = store.client.db(database).collection(postsCollection);
    const { date, hour } = formatParisDateParts();

    const doc = {
      body: rawBody,
      createdBy: s.userId,
      date,
      hour,
      likes: 0,
      likedBy: [] as number[],
      hashtags: [] as string[],
      comments: [] as unknown[],
    };

    const result = await coll.insertOne(doc);
    const created = await coll.findOne({ _id: result.insertedId });
    if (!created) {
      return res.status(500).json({ error: 'Publication créée mais introuvable' });
    }

    const post = shapePostFromMongo(created as unknown as MongoPostDoc, s.userId);
    const [enriched] = await enrichPostsWithAuthors([post]);
    return res.status(201).json({ post: enriched });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Impossible de publier' });
  }
});

postsRouter.get('/', async (req, res) => {
  const s = req.session as { isConnected?: boolean; userId?: number };
  if (!s.isConnected) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const { database = 'db-CERI', postsCollection = 'CERISoNet' } = config.databases.mongodb;
    const coll = store.client.db(database).collection(postsCollection);
    const docs = await coll.find({}).sort({ _id: -1 }).toArray();
    const viewerId =
      typeof s.userId === 'number' && Number.isInteger(s.userId) ? s.userId : undefined;
    const base = docs.map((d) => shapePostFromMongo(d as unknown as MongoPostDoc, viewerId));
    const posts = await enrichPostsWithAuthors(base);
    return res.json({ posts });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Impossible de charger les publications' });
  }
});

postsRouter.post('/:postId/like', async (req, res) => {
  const s = req.session as { isConnected?: boolean; userId?: number };
  if (!s.isConnected || s.userId == null) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  const postOid = parseObjectId(req.params.postId);
  if (!postOid) {
    return res.status(400).json({ error: 'Identifiant de publication invalide' });
  }

  try {
    const { database = 'db-CERI', postsCollection = 'CERISoNet' } = config.databases.mongodb;
    const coll = store.client.db(database).collection(postsCollection);
    const existing = await coll.findOne({ _id: postOid });
    if (!existing) {
      return res.status(404).json({ error: 'Publication introuvable' });
    }

    const lb = normalizeLikedBy((existing as { likedBy?: unknown }).likedBy);
    const uid = s.userId;
    const hadLiked = lb.includes(uid);
    const nextLb = hadLiked ? lb.filter((id) => id !== uid) : [...lb, uid];
    const prevLikes =
      typeof existing.likes === 'number' && Number.isFinite(existing.likes)
        ? existing.likes
        : 0;
    const newLikes = Math.max(0, prevLikes + (hadLiked ? -1 : 1));

    await coll.updateOne({ _id: postOid }, { $set: { likedBy: nextLb, likes: newLikes } });

    const updated = await coll.findOne({ _id: postOid });
    if (!updated) {
      return res.status(500).json({ error: 'Publication introuvable après mise à jour' });
    }

    const post = shapePostFromMongo(updated as unknown as MongoPostDoc, s.userId);
    const enrichedList = await enrichPostsWithAuthors([post]);
    const enriched = enrichedList[0];
    if (!enriched) {
      return res.status(500).json({ error: 'Impossible d’enrichir la publication' });
    }

    const pool = getPostgres();
    const { rows } = await pool.query<{ pseudo: string }>(
      `SELECT pseudo FROM fredouil.compte WHERE id = $1 LIMIT 1`,
      [s.userId],
    );
    const pseudo = rows[0]?.pseudo?.trim() || `Utilisateur #${s.userId}`;

    const io = getIo(req);
    io?.emit('postLikeUpdated', {
      postId: enriched._id,
      likes: newLikes,
      actorId: s.userId,
      pseudo,
      removing: hadLiked,
    });

    return res.status(200).json({ post: enriched });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Impossible de mettre à jour le j’aime' });
  }
});

postsRouter.post('/:postId/comments', async (req, res) => {
  const s = req.session as { isConnected?: boolean; userId?: number };
  if (!s.isConnected || s.userId == null) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  const postOid = parseObjectId(req.params.postId);
  if (!postOid) {
    return res.status(400).json({ error: 'Identifiant de publication invalide' });
  }

  const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!rawText) {
    return res.status(400).json({ error: 'Le commentaire est vide' });
  }
  if (rawText.length > MAX_COMMENT_LENGTH) {
    return res
      .status(400)
      .json({ error: `Commentaire trop long (${MAX_COMMENT_LENGTH} caractères max)` });
  }

  try {
    const { database = 'db-CERI', postsCollection = 'CERISoNet' } = config.databases.mongodb;
    const coll = store.client.db(database).collection(postsCollection);
    const existing = await coll.findOne({ _id: postOid });
    if (!existing) {
      return res.status(404).json({ error: 'Publication introuvable' });
    }

    const { date, hour } = formatParisDateParts();
    const comment = {
      _id: new ObjectId(),
      text: rawText,
      commentedBy: s.userId,
      date,
      hour,
    };

    await coll.updateOne({ _id: postOid }, { $push: { comments: comment } });
    const updated = await coll.findOne({ _id: postOid });
    if (!updated) {
      return res.status(500).json({ error: 'Publication introuvable après mise à jour' });
    }

    const post = shapePostFromMongo(updated as unknown as MongoPostDoc, s.userId);
    const [enriched] = await enrichPostsWithAuthors([post]);
    return res.status(201).json({ post: enriched });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Impossible d’ajouter le commentaire' });
  }
});

postsRouter.delete('/:postId/comments/:commentId', async (req, res) => {
  const s = req.session as { isConnected?: boolean; userId?: number };
  if (!s.isConnected || s.userId == null) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  const postOid = parseObjectId(req.params.postId);
  const commentOid = parseObjectId(req.params.commentId);
  if (!postOid || !commentOid) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  try {
    const { database = 'db-CERI', postsCollection = 'CERISoNet' } = config.databases.mongodb;
    const coll = store.client.db(database).collection(postsCollection);

    const pull = await coll.updateOne(
      { _id: postOid },
      { $pull: { comments: { _id: commentOid, commentedBy: s.userId } } },
    );

    if (pull.matchedCount === 0) {
      return res.status(404).json({ error: 'Publication introuvable' });
    }
    if (pull.modifiedCount === 0) {
      return res.status(403).json({ error: 'Commentaire introuvable ou suppression non autorisée' });
    }

    const updated = await coll.findOne({ _id: postOid });
    if (!updated) {
      return res.status(500).json({ error: 'Publication introuvable après suppression' });
    }

    const post = shapePostFromMongo(updated as unknown as MongoPostDoc, s.userId);
    const [enriched] = await enrichPostsWithAuthors([post]);
    return res.status(200).json({ post: enriched });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Impossible de supprimer le commentaire' });
  }
});

postsRouter.delete('/:postId', async (req, res) => {
  const s = req.session as { isConnected?: boolean; userId?: number };
  if (!s.isConnected || s.userId == null) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  const postOid = parseObjectId(req.params.postId);
  if (!postOid) {
    return res.status(400).json({ error: 'Identifiant de publication invalide' });
  }

  try {
    const { database = 'db-CERI', postsCollection = 'CERISoNet' } = config.databases.mongodb;
    const coll = store.client.db(database).collection(postsCollection);

    const existing = await coll.findOne({ _id: postOid });
    if (!existing) {
      return res.status(404).json({ error: 'Publication introuvable' });
    }
    const owner =
      typeof existing.createdBy === 'number' && Number.isInteger(existing.createdBy)
        ? existing.createdBy
        : null;
    if (owner !== s.userId) {
      return res.status(403).json({ error: 'Suppression non autorisée' });
    }

    const del = await coll.deleteOne({ _id: postOid, createdBy: s.userId });
    if (del.deletedCount === 0) {
      return res.status(500).json({ error: 'Suppression impossible' });
    }

    return res.status(204).send();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Impossible de supprimer la publication' });
  }
});

export default postsRouter;
