// ============= src/database/characters.js =============
import Database from 'better-sqlite3';
import path from 'path';

// Create/open database file
const db = new Database(path.join(process.cwd(), 'characters.db'));

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    class TEXT,
    realm TEXT,
    is_main BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
  )
`);

// Prepared statements for better performance
const statements = {
  addCharacter: db.prepare(`
    INSERT INTO characters (user_id, name, class, realm, is_main)
    VALUES (?, ?, ?, ?, ?)
  `),
  
  getCharacters: db.prepare(`
    SELECT * FROM characters 
    WHERE user_id = ? 
    ORDER BY is_main DESC, created_at ASC
  `),
  
  characterExists: db.prepare(`
    SELECT COUNT(*) as count 
    FROM characters 
    WHERE user_id = ? AND LOWER(name) = LOWER(?)
  `),
  
  unmarkAllMains: db.prepare(`
    UPDATE characters 
    SET is_main = 0 
    WHERE user_id = ?
  `),
  
  removeCharacter: db.prepare(`
    DELETE FROM characters 
    WHERE user_id = ? AND LOWER(name) = LOWER(?)
  `),
  
  getCharacter: db.prepare(`
    SELECT * FROM characters 
    WHERE user_id = ? AND LOWER(name) = LOWER(?)
  `)
};

export class CharacterDB {
  static addCharacter(userId, name, charClass, realm, isMain = false) {
    // If setting as main, unmark all others first
    if (isMain) {
      statements.unmarkAllMains.run(userId);
    }

    return statements.addCharacter.run(userId, name, charClass, realm, isMain ? 1 : 0);
  }

  static getCharacters(userId) {
    return statements.getCharacters.all(userId).map(char => ({
      name: char.name,
      class: char.class,
      realm: char.realm,
      isMain: char.is_main === 1,
      createdAt: char.created_at
    }));
  }

  static characterExists(userId, name) {
    const result = statements.characterExists.get(userId, name);
    return result.count > 0;
  }

  static getCharacter(userId, name) {
    const char = statements.getCharacter.get(userId, name);
    if (!char) return null;
    
    return {
      name: char.name,
      class: char.class,
      realm: char.realm,
      isMain: char.is_main === 1,
      createdAt: char.created_at
    };
  }

  static removeCharacter(userId, name) {
    return statements.removeCharacter.run(userId, name);
  }

  // Gracefully close database connection
  static close() {
    db.close();
  }
}

