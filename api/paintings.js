import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

// Validate MongoDB module is available
if (!MongoClient || !ObjectId) {
  console.error('MongoDB module not properly imported');
}

// Helper function to send JSON response
function sendJson(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(data);
}

export default async function handler(req, res) {
  // Ensure we always return JSON, even on errors
  try {
    // Check if MongoDB URI is configured
    if (!MONGODB_URI) {
      console.error('MONGODB_URI environment variable is not set');
      return sendJson(res, 500, { 
        error: 'Database not configured',
        message: 'MongoDB connection string is missing. Please configure MONGODB_URI environment variable.' 
      });
    }

    // Ensure connection string is properly formatted
    let connectionString = MONGODB_URI.trim();
    
    // For mongodb+srv, ensure retryWrites and w parameters are set
    if (connectionString.includes('mongodb+srv://')) {
      // Add retryWrites and w=majority if not present
      if (!connectionString.includes('retryWrites')) {
        connectionString += (connectionString.includes('?') ? '&' : '?') + 'retryWrites=true&w=majority';
      }
    }
    
    const client = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 1,
    });
    
    try {
      await client.connect();
      const db = client.db('soup_paintings');
      
      if (req.method === 'POST') {
        // Save painting
        let body;
        try {
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (parseError) {
          return sendJson(res, 400, { 
            error: 'Invalid JSON',
            message: 'Request body must be valid JSON' 
          });
        }
        
        const { imageData, name } = body;
        
        if (!imageData || !name) {
          return sendJson(res, 400, { 
            error: 'Missing required fields',
            message: 'Both imageData and name are required' 
          });
        }
        
        const result = await db.collection('paintings').insertOne({
          imageData,
          name,
          createdAt: new Date()
        });
        return sendJson(res, 201, { id: result.insertedId });
      }
      
      if (req.method === 'GET') {
        // Get all paintings
        const paintings = await db.collection('paintings').find({}).sort({ createdAt: -1 }).toArray();
        return sendJson(res, 200, paintings);
      }
      
      if (req.method === 'DELETE') {
        // Delete painting
        let body;
        try {
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (parseError) {
          return sendJson(res, 400, { 
            error: 'Invalid JSON',
            message: 'Request body must be valid JSON' 
          });
        }
        
        const { id } = body;
        if (!id) {
          return sendJson(res, 400, { 
            error: 'Missing id',
            message: 'ID is required to delete a painting' 
          });
        }
        await db.collection('paintings').deleteOne({ _id: new ObjectId(id) });
        return sendJson(res, 200, { success: true });
      }
      
      // Method not allowed
      return sendJson(res, 405, { 
        error: 'Method not allowed',
        message: `Method ${req.method} is not supported` 
      });
      
    } catch (error) {
      console.error('API Error:', error);
      console.error('Error name:', error.name);
      console.error('Error code:', error.code);
      console.error('Error stack:', error.stack);
      
      // Provide more specific error messages
      let errorMessage = error.message || 'An unexpected error occurred';
      if (error.name === 'MongoServerSelectionError') {
        errorMessage = 'Failed to connect to MongoDB. Please check your connection string and network settings.';
      } else if (error.name === 'MongoNetworkError') {
        errorMessage = 'Network error connecting to MongoDB. Please check your internet connection and MongoDB Atlas settings.';
      }
      
      return sendJson(res, 500, { 
        error: 'Internal server error',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Error closing MongoDB connection:', closeError);
      }
    }
  } catch (error) {
    // Catch any errors outside the main try block
    console.error('Handler Error:', error);
    return sendJson(res, 500, { 
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred' 
    });
  }
}
