import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

function sendJson(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(data);
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (!MONGODB_URI) {
      return sendJson(res, 500, { 
        error: 'Database not configured',
        message: 'MongoDB connection string is missing.'
      });
    }

    let connectionString = MONGODB_URI.trim();
    if (connectionString.includes('mongodb+srv://')) {
      if (!connectionString.includes('retryWrites')) {
        connectionString += (connectionString.includes('?') ? '&' : '?') + 'retryWrites=true&w=majority';
      }
    }

    const client = new MongoClient(connectionString, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      waitQueueTimeoutMS: 10000,
      retryWrites: true
    });

    await client.connect();
    const db = client.db('soupsoup');
    const worriesCollection = db.collection('worries');

    // POST - Add a new worry
    if (req.method === 'POST') {
      const { worry } = req.body;

      if (!worry || typeof worry !== 'string' || worry.trim().length === 0) {
        return sendJson(res, 400, { error: 'Worry text is required' });
      }

      const worryRecord = {
        text: worry.trim(),
        timestamp: new Date(),
        _id: new ObjectId()
      };

      const result = await worriesCollection.insertOne(worryRecord);
      await client.close();

      return sendJson(res, 201, { 
        success: true,
        id: result.insertedId
      });
    }

    // GET - Retrieve all worries (random order for anonymity)
    if (req.method === 'GET') {
      const worries = await worriesCollection.aggregate([
        { $sample: { size: 50 } } // Random sample to maintain anonymity
      ]).toArray();

      // Map to simple text objects
      const simplifiedWorries = worries.map(w => ({
        text: w.text,
        id: w._id
      }));

      await client.close();

      return sendJson(res, 200, simplifiedWorries);
    }

    await client.close();
    return sendJson(res, 405, { error: 'Method not allowed' });

  } catch (error) {
    console.error('Worries API Error:', error);
    let errorMessage = 'An unexpected error occurred';

    if (error.name === 'MongoServerError') {
      errorMessage = 'Database error. Please try again later.';
    } else if (error.name === 'MongoNetworkError') {
      errorMessage = 'Network error connecting to database.';
    } else if (error.name === 'MongoAuthenticationError') {
      errorMessage = 'Authentication failed.';
    }

    return sendJson(res, 500, { 
      error: 'Internal server error',
      message: errorMessage
    });
  }
}
