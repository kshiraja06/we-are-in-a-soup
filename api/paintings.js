import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

export default async function handler(req, res) {
  // Check if MongoDB URI is configured
  if (!MONGODB_URI) {
    console.error('MONGODB_URI environment variable is not set');
    return res.status(500).json({ 
      error: 'Database not configured',
      message: 'MongoDB connection string is missing. Please configure MONGODB_URI environment variable.' 
    });
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('soup_paintings');
    
    if (req.method === 'POST') {
      // Save painting
      const { imageData, name } = req.body;
      
      if (!imageData || !name) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          message: 'Both imageData and name are required' 
        });
      }
      
      const result = await db.collection('paintings').insertOne({
        imageData,
        name,
        createdAt: new Date()
      });
      return res.status(201).json({ id: result.insertedId });
    }
    
    if (req.method === 'GET') {
      // Get all paintings
      const paintings = await db.collection('paintings').find({}).sort({ createdAt: -1 }).toArray();
      return res.status(200).json(paintings);
    }
    
    if (req.method === 'DELETE') {
      // Delete painting
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ 
          error: 'Missing id',
          message: 'ID is required to delete a painting' 
        });
      }
      await db.collection('paintings').deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true });
    }
    
    // Method not allowed
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: `Method ${req.method} is not supported` 
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred' 
    });
  } finally {
    try {
      await client.close();
    } catch (closeError) {
      console.error('Error closing MongoDB connection:', closeError);
    }
  }
}
