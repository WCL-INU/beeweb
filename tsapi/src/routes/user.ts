import express, { Request, Response } from 'express';
import { User } from '../types';
import { getUserById } from '../db/user';

const router = express.Router();
router.use(express.json());

router.post('/login', async (req: Request, res: Response) => {
    // #swagger.tags = ['User']
    // #swagger.description = 'Endpoint to login a user'
    try {
        /*  #swagger.parameters['body'] = {
                in: 'body',
                required: true,
                schema: {
                    id: "user1",
                    pw: "password"
                }
        } */
        const id = req.body.id as string;
        const pw = req.body.pw as string;
        if (!id || !pw) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const user = await getUserById(id);
        if (user && user.pw === pw) {
            // #swagger.responses[200] = { description: 'User logged in successfully' }
            res.status(200).json({ success: true, user: { id: user.id, grade: user.grade } });
            return;
        } else {
            // #swagger.responses[401] = { description: 'Invalid credentials' }
            res.status(401).json({ success: false, message: 'Invalid credentials' });
            return;
        }
    } catch (error) {
        console.error('Error logging in:', error);
        // #swagger.responses[500] = { description: 'Internal Server Error' }
        res.status(500).json({ error: 'Internal Server Error' });
        return;
    }
});

router.get('/:id', async (req: Request, res: Response) => {
    // #swagger.tags = ['User']
    // #swagger.description = 'Endpoint to fetch a user by ID'
    try {
        const id = req.params.id as string;
        if (!id) {
            // #swagger.responses[400] = { description: 'Missing required fields' }
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const user = await getUserById(id);
        if (user) {
            // #swagger.responses[200] = { description: 'User fetched successfully' }
            res.status(200).json({ id: user.id, grade: user.grade });
            return;
        } else {
            // #swagger.responses[404] = { description: 'User not found' }
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
    } catch (error) {
        console.error('Error fetching user:', error);
        // #swagger.responses[500] = { description: 'Internal Server Error' }
        res.status(500).json({ error: 'Internal Server Error' });
        return;
    }
});

export default router;