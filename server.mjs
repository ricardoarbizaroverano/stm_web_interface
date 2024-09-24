import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const app = express();
const upload = multer();

// Ensure that GITHUB_TOKEN is set
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Your GitHub token from Heroku config
if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN is not set in environment variables');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the root directory
app.use(express.static(path.resolve()));
console.log('Static files are being served from:', path.resolve());

// Serve the main HTML file
app.get('/', (req, res) => {
    console.log('Serving index.html');
    res.sendFile(path.join(process.cwd(), 'index.html'));
});

// Handle file uploads
app.post('/upload', upload.single('file'), async (req, res) => {
    console.log('Received POST request on /upload');

    // Since we're using multer, req.body will not include fields unless we use the correct middleware
    const receivedPassword = req.body.password || 'not provided';
    console.log('Received password:', receivedPassword);

    // Password validation moved to client-side for security reasons
    // It's better to handle password validation on the server side
    if (receivedPassword !== 'mst05072024') {
        console.log('Invalid password attempt');
        return res.status(403).send('Invalid password. No permission to save the mix.');
    }

    console.log('Password validated successfully');

    // Check if file was received
    if (!req.file) {
        console.error('No file received in the request');
        return res.status(400).send('No file uploaded.');
    } else {
        console.log('Received file:', req.file.originalname);
    }

    // Generate a unique filename based on the existing files in the GitHub repo
    const repoUrl = 'https://api.github.com/repos/ricardoarbizaroverano/maquinasonoradeltiempo/contents/stm_users_mix';

    try {
        // Fetch existing files from the GitHub repository
        console.log('Fetching existing files from GitHub repository');
        const response = await fetch(repoUrl, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error fetching repository contents:', errorText);
            throw new Error('Failed to fetch repository contents');
        }

        const files = await response.json();
        console.log('Existing files retrieved:', files.map(f => f.name));

        const existingFiles = files.map(file => file.name);
        const lastFile = existingFiles.filter(file => file.startsWith('stm_mix_') && file.endsWith('.webm')).pop();
        const newNumber = lastFile ? parseInt(lastFile.split('_')[2].split('.')[0]) + 1 : 1;

        const newFileName = `stm_mix_${newNumber}.webm`;
        const newFilePath = `stm_users_mix/${newFileName}`;

        // Prepare the content to be uploaded
        const fileContent = req.file.buffer.toString('base64');

        // Create the payload for the GitHub API
        const payload = {
            message: `Add ${newFileName}`,
            content: fileContent,
            path: newFilePath
        };

        console.log('Uploading new file to GitHub:', newFileName);

        // Upload the file to GitHub
        const uploadResponse = await fetch(`${repoUrl}/${encodeURIComponent(newFileName)}`, {
            method: 'PUT',
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(payload)
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Error uploading file to GitHub:', errorText);
            throw new Error('Failed to upload file to GitHub');
        }

        console.log(`File ${newFileName} uploaded successfully to GitHub`);
        res.status(200).send(`${newFileName} uploaded successfully.`);
    } catch (error) {
        console.error('An error occurred:', error.message);
        res.status(500).send('Error uploading to GitHub');
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
