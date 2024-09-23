import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import fetch from 'node-fetch';

const app = express();
const upload = multer();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Your GitHub token from Heroku config

// Serve static files from the root directory
app.use(express.static(path.resolve()));

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'index.html'));
});

app.post('/upload', upload.single('file'), async (req, res) => {
    const receivedPassword = req.body.password;
    if (receivedPassword !== 'mst05072024') {
        return res.status(403).send('Invalid password. No permission to save the mix.');
    }

    // Generate a unique filename based on the existing files in the GitHub repo
    const repoUrl = 'https://api.github.com/repos/your_username/your_repository/contents/stm_users_mix';
    
    try {
        const response = await fetch(repoUrl, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        const files = await response.json();
        
        const existingFiles = files.map(file => file.name);
        const lastFile = existingFiles.filter(file => file.startsWith('stm_mix_') && file.endsWith('.mp3')).pop();
        const newNumber = lastFile ? parseInt(lastFile.split('_')[2].split('.')[0]) + 1 : 1;

        const newFileName = `stm_mix_${newNumber}.mp3`;
        const newFilePath = path.join('stm_users_mix', newFileName);

        // Upload the file to GitHub
        const uploadResponse = await fetch(repoUrl, {
            method: 'PUT',
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Add ${newFileName}`,
                content: req.file.buffer.toString('base64'),
                path: newFilePath
            })
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file to GitHub');
        }

        res.status(200).send(`${newFileName} uploaded successfully.`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error uploading to GitHub');
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
