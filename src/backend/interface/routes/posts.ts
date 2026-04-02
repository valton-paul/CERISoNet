import { Router } from 'express';
import { store } from '../../database/mongodb';
import config from '../../config/config';

const postsRouter = Router();

postsRouter.get('/', async (req, res) => {
  const s = req.session as { isConnected?: boolean };
  if (!s.isConnected) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const { database = 'db-CERI', postsCollection = 'CERISoNet' } = config.databases.mongodb;
    const coll = store.client.db(database).collection(postsCollection);
    const docs = await coll.find({}).sort({ _id: -1 }).toArray();
    const posts = docs.map((d) => ({
      ...d,
      _id: d._id.toString(),
      shared: d.shared != null ? String(d.shared) : undefined,
    }));
    return res.json({ posts });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Impossible de charger les publications' });
  }
});

export default postsRouter;
