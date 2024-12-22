import { pool } from './index';
import { User } from '../types';

export const getUserById = async (id: string): Promise<User|null> => {
    try {
        const query = 'SELECT id, pw, grade FROM accounts WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        const results = rows as User[];
        if (results.length > 0) {
            return results[0] as User;
        }
        return null;
    } catch (error) {
        throw error;
    }
}