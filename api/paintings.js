import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

export default async function handler(req, res) {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('soup_paintings');
    
    if (req.method === 'POST') {
      // Save painting
      const { imageData, name } = req.body;
      const result = await db.collection('paintings').insertOne({
        imageData,
        name,
        createdAt: new Date()
      });
      return res.status(201).json({ id: result.insertedId });
    }
    
    if (req.method === 'GET') {
      // Get all paintings
      const paintings = await db.collection('paintings').find({}).toArray();
      return res.status(200).json(paintings);
    }
    
    if (req.method === 'DELETE') {
      // Delete painting
      const { id } = req.body;
      await db.collection('paintings').deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true });
    }
    
  } finally {
    await client.close();
  }
}