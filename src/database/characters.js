// src/database/characters.js
// Drop-in replacement for the old SQLite CharacterDB.
// Same API: addCharacter, getCharacters, characterExists, getCharacter, removeCharacter, close
import { query, pool } from '../db.js';

export const CharacterDB = {
  async addCharacter(userId, name, charClass, realm, isMain) {
    if (isMain) {
      await query('UPDATE public.characters SET is_main = false WHERE user_id = $1', [userId]);
    }
    await query(
      `INSERT INTO public.characters (user_id, name, class, realm, is_main)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, name) DO UPDATE
         SET class = EXCLUDED.class,
             realm = EXCLUDED.realm,
             is_main = EXCLUDED.is_main`,
      [userId, name, charClass || null, realm || null, !!isMain]
    );
  },

  async getCharacters(userId) {
    const { rows } = await query(
      `SELECT id, user_id, name, class, realm, is_main, created_at
         FROM public.characters
        WHERE user_id = $1
     ORDER BY is_main DESC, created_at ASC`,
      [userId]
    );
    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      class: r.class || null,
      realm: r.realm || null,
      isMain: r.is_main,
      createdAt: r.created_at,
    }));
  },

  async characterExists(userId, name) {
    const { rows } = await query(
      `SELECT 1
         FROM public.characters
        WHERE user_id = $1 AND LOWER(name) = LOWER($2)
        LIMIT 1`,
      [userId, name]
    );
    return rows.length > 0;
  },

  async getCharacter(userId, name) {
    const { rows } = await query(
      `SELECT id, user_id, name, class, realm, is_main, created_at
         FROM public.characters
        WHERE user_id = $1 AND LOWER(name) = LOWER($2)
        LIMIT 1`,
      [userId, name]
    );
    const r = rows[0];
    return r
      ? {
          id: r.id,
          userId: r.user_id,
          name: r.name,
          class: r.class || null,
          realm: r.realm || null,
          isMain: r.is_main,
          createdAt: r.created_at,
        }
      : null;
  },

  async removeCharacter(userId, name) {
    await query(
      `DELETE FROM public.characters
        WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
      [userId, name]
    );
  },

  async close() {
    await pool.end();
  },
};
