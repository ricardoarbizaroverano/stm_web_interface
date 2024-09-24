import express from 'express';
import multer from 'multer';
import path from 'path';
import fetch from 'node-fetch';

const app = express();
const upload = multer();

// Ensure that GITHUB_TOKEN is set
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Your GitHub token from Heroku config
if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN is not set in environment variables');
}

// Middleware to parse JSON and URL-encoded data
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

    // Extract password from form data
    const receivedPassword = req.body.password || 'not provided';
    console.log('Received password:', receivedPassword);

    // Validate the password
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
    const repoOwner = 'ricardoarbizaroverano';
    const repoName = 'stm_web_interface'; // Ensure this is your repository name
    const filePathInRepo = 'stm_users_mix'; // Directory in the repo where files are stored
    const branch = 'main'; // Adjust if your default branch is different
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePathInRepo}?ref=${branch}`;

    try {
        // Fetch existing files from the GitHub repository
        console.log('Fetching existing files from GitHub repository');
        const response = await fetch(apiUrl, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });

        let files = [];
        if (response.status === 404) {
            // Directory does not exist, so assume no existing files
            console.log('Directory does not exist. Proceeding with empty file list.');
            files = [];
        } else if (!response.ok) {
            const errorText = await response.text();
            console.error('Error fetching repository contents:', errorText);
            throw new Error('Failed to fetch repository contents');
        } else {
            files = await response.json();
            console.log('Existing files retrieved:', files.map((f) => f.name));
        }

        // Determine the new file name
        const existingFiles = files.map((file) => file.name);
        const mixFiles = existingFiles
            .filter((file) => file.startsWith('stm_mix_') && file.endsWith('.mp3')) // Updated extension
            .sort();

        let newNumber = 1;
        if (mixFiles.length > 0) {
            const lastFile = mixFiles[mixFiles.length - 1];
            const match = lastFile.match(/stm_mix_(\d+)\.mp3/); // Updated extension
            const lastNumber = match ? parseInt(match[1], 10) : 0;
            newNumber = lastNumber + 1;
        }

        const newFileName = `stm_mix_${newNumber}.mp3`; // Updated extension
        const newFilePath = `${filePathInRepo}/${newFileName}`;

        // Prepare the content to be uploaded
        const fileContent = req.file.buffer.toString('base64');

        // Create the payload for the GitHub API
        const payload = {
            message: `Add ${newFileName}`,
            content: fileContent,
            branch: branch,
        };

        // Construct the upload URL
        const uploadUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${newFilePath}`;

        console.log('Uploading new file to GitHub:', newFileName);

        // Upload the file to GitHub
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
            },
            body: JSON.stringify(payload),
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
