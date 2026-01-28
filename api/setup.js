
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Check if ENV vars are loaded
  const hasUrl = !!process.env.POSTGRES_URL;
  
  if (!hasUrl) {
      console.error("❌ MISSING POSTGRES_URL");
      return res.status(500).json({ 
          error: "Database configuration missing", 
          details: "POSTGRES_URL environment variable is not defined. Please link the Vercel Postgres store to this project in the Vercel Dashboard and REDEPLOY." 
      });
  }

  try {
    console.log("🛠 Connection Test...");
    
    // 1. Simple Connection Test
    try {
        await sql`SELECT 1;`;
        console.log("✅ Connection Successful");
    } catch (connErr) {
        console.error("❌ Connection Failed:", connErr);
        
        let hint = "The Vercel Postgres database might be suspended or credentials are invalid.";
        
        // Handle specific Neon "Not Found" error (HTTP 404 from DB proxy)
        if (connErr.message && connErr.message.includes('HTTP status 404')) {
            hint = "CRITICAL: The Database URL in your environment variables points to a database that does not exist or has been deleted. Please go to Vercel Dashboard -> Storage -> Connect Store, then Redeploy.";
        }

        // Masked URL for debugging
        const maskedUrl = process.env.POSTGRES_URL ? process.env.POSTGRES_URL.replace(/:[^:@]+@/, ':****@') : 'N/A';

        return res.status(500).json({
            error: "Database Connection Failed",
            details: connErr.message,
            hint: hint,
            debugUrl: maskedUrl
        });
    }

    console.log("🛠 Creating Tables...");

    // 2. Projects Table
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        data JSONB NOT NULL,
        updated_at BIGINT,
        created_at BIGINT
      );
    `;
    
    // 3. Index
    await sql`CREATE INDEX IF NOT EXISTS idx_owner_id ON projects (owner_id);`;

    console.log("✅ Setup Complete.");

    return res.status(200).json({ 
        success: true, 
        message: "Database connected and initialized successfully." 
    });

  } catch (error) {
    console.error("Setup Critical Error:", error);
    return res.status(500).json({ 
        error: "Setup Critical Failure", 
        details: error.message 
    });
  }
}
