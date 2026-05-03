import { Router } from 'express';
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
      hashtags: [] as string[],
      comments: [] as unknown[],
    };

    const result = await coll.insertOne(doc);
    const created = await coll.findOne({ _id: result.insertedId });
    if (!created) {
      return res.status(500).json({ error: 'Publication créée mais introuvable' });
    }

    const post = {
      ...created,
      _id: created._id.toString(),
      shared: created.shared != null ? String(created.shared) : undefined,
      createdBy: created.createdBy,
      comments: serializeCommentIds(created.comments),
    };
    const [enriched] = await enrichPostsWithAuthors([post]);
    return res.status(201).json({ post: enriched });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Impossible de publier' });
  }
});

postsRouter.get('/', async (req, res) => {
  const s = req.session as { isConnected?: boolean };
  if (!s.isConnected) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const { database = 'db-CERI', postsCollection = 'CERISoNet' } = config.databases.mongodb;
    const coll = store.client.db(database).collection(postsCollection);
    const docs = await coll.find({}).sort({ _id: -1 }).toArray();
    const base = docs.map((d) => ({
      ...d,
      _id: d._id.toString(),
      shared: d.shared != null ? String(d.shared) : undefined,
      createdBy: d.createdBy,
      comments: serializeCommentIds(d.comments),
    }));
    const posts = await enrichPostsWithAuthors(base);
    return res.json({ posts });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Impossible de charger les publications' });
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

    const post = {
      ...updated,
      _id: updated._id.toString(),
      shared: updated.shared != null ? String(updated.shared) : undefined,
      createdBy: updated.createdBy,
      comments: serializeCommentIds(updated.comments),
    };
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

    const post = {
      ...updated,
      _id: updated._id.toString(),
      shared: updated.shared != null ? String(updated.shared) : undefined,
      createdBy: updated.createdBy,
      comments: serializeCommentIds(updated.comments),
    };
    const [enriched] = await enrichPostsWithAuthors([post]);
    return res.status(200).json({ post: enriched });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Impossible de supprimer le commentaire' });
  }
});

export default postsRouter;
