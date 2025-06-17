import { sql } from './db';
import { hashPassword } from './auth';
import fs from 'fs';
import path from 'path';

export async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    // Read schema file
    const schemaPath = path.join(process.cwd(), 'lib', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Split by semicolons but be careful with functions/triggers
    const statements = schema
      .split(/;(?=\s*(?:CREATE|ALTER|INSERT|DROP|GRANT))/i)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.includes('$2a$10$YourHashedPasswordHere')) {
        // Special handling for admin user - hash the password
        const hashedPassword = await hashPassword('admin123');
        const updatedStatement = statement.replace(
          '$2a$10$YourHashedPasswordHere',
          hashedPassword
        );
        await sql.unsafe(updatedStatement + ';');
      } else {
        await sql.unsafe(statement + ';');
      }
    }
    
    console.log('Migrations completed successfully!');
    return { success: true };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error };
  }
}

// Script to run migrations
if (require.main === module) {
  runMigrations()
    .then(result => {
      if (result.success) {
        console.log('✅ Database setup complete!');
        process.exit(0);
      } else {
        console.error('❌ Migration failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}