// Initialize the AudioContext
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Create gain nodes and panner nodes for each track
const gainNodes = [];
const pannerNodes = [];
const audioElements = [];
const trackFiles = ["1.mp3", "2.mp3", "3.mp3", "4.mp3"];
const tracks = [];

// Load the audio files and set up the audio graph
trackFiles.forEach((track, index) => {
    const audioElement = new Audio(track);
    const trackSource = audioContext.createMediaElementSource(audioElement);
    const gainNode = audioContext.createGain();
    const pannerNode = audioContext.createStereoPanner();

    // Connect the audio graph: source -> gain -> panner -> destination
    trackSource.connect(gainNode).connect(pannerNode).connect(audioContext.destination);

    // Set initial values for gain and pan
    gainNode.gain.value = 0.5;  // Default volume
    pannerNode.pan.value = 0;   // Default pan

    // Store nodes and elements for later control
    gainNodes.push(gainNode);
    pannerNodes.push(pannerNode);
    audioElements.push(audioElement);
    tracks.push(trackSource);
});

// Play button event listener
document.getElementById('play').addEventListener('click', async () => {
    // Ensure the AudioContext is started
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    // Play each track
    audioElements.forEach(audioElement => {
        audioElement.loop = true;  // Enable looping
        audioElement.play();
    });

    console.log('Playback started');
});

// Stop button event listener
document.getElementById('stop').addEventListener('click', () => {
    audioElements.forEach(audioElement => {
        audioElement.pause();
        audioElement.currentTime = 0; // Reset playback to start
    });

    console.log('Playback stopped');
});

// Function to show the password modal
function showPasswordModal() {
    document.getElementById('password-modal').style.display = 'flex';
}

// Function to hide the password modal
function hidePasswordModal() {
    document.getElementById('password-modal').style.display = 'none';
}

// Render and save the mix
document.getElementById('render').addEventListener('click', () => {
    showPasswordModal(); // Show the modal when the render button is clicked
});

// Close modal button event listener
document.getElementById('close-modal').addEventListener('click', hidePasswordModal);

// Validate password and proceed with rendering
document.getElementById('submit-password').addEventListener('click', async () => {
    const password = document.getElementById('password').value;
    const successMessageElement = document.getElementById('success-message');

    // Reset success message
    successMessageElement.style.display = 'none';
    successMessageElement.innerText = '';

    if (password !== 'mst05072024') {
        alert('Contraseña incorrecta. No tienes permiso para guardar.');
        return;
    }

    // Show feedback for correct password
    successMessageElement.innerText = 'Contraseña correcta. Procesando mezcla...';
    successMessageElement.style.color = 'blue';
    successMessageElement.style.display = 'block';

    // Create a destination for recording
    const destination = audioContext.createMediaStreamDestination();
    tracks.forEach((track, index) => {
        track.connect(destination);
    });

    // Use MediaRecorder to record the output
    const recorder = new MediaRecorder(destination.stream);
    const chunks = [];

    recorder.ondataavailable = event => {
        chunks.push(event.data);
    };

    recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/mp3' });
        const formData = new FormData();
        formData.append('file', blob, 'mixture.mp3');

        // Send the audio file to the server
        const response = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.text();
        if (response.ok) {
            successMessageElement.innerText = `Tu mezcla fue guardada con éxito en el llavero #${result}`;
            successMessageElement.style.color = 'green';
        } else {
            successMessageElement.innerText = 'Error al guardar la mezcla: ' + result;
            successMessageElement.style.color = 'red';
        }

        successMessageElement.style.display = 'block';
    };

    // Start recording
    recorder.start();

    // Stop recording after 10 seconds
    setTimeout(() => {
        recorder.stop();
    }, 10000);
});
