// Initialize the AudioContext
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
console.log('AudioContext initialized:', audioContext);

// Create gain nodes and panner nodes for each track
const gainNodes = [];
const pannerNodes = [];
const audioElements = [];
const trackFiles = ["1.mp3", "2.mp3", "3.mp3", "4.mp3"];
const tracks = [];

// Load the audio files and set up the audio graph
trackFiles.forEach((track, index) => {
    console.log(`Setting up track ${index + 1}:`, track);
    const audioElement = new Audio(track);
    audioElement.crossOrigin = "anonymous"; // Ensure cross-origin compatibility
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

    // Add event listeners for volume and pan controls
    document.getElementById(`volume${index + 1}`).addEventListener('input', (event) => {
        gainNode.gain.value = parseFloat(event.target.value);
        console.log(`Volume for track ${index + 1} set to:`, gainNode.gain.value);
    });

    document.getElementById(`pan${index + 1}`).addEventListener('input', (event) => {
        pannerNode.pan.value = parseFloat(event.target.value);
        console.log(`Pan for track ${index + 1} set to:`, pannerNode.pan.value);
    });
});

// Play button event listener
document.getElementById('play').addEventListener('click', async () => {
    // Ensure the AudioContext is started
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('AudioContext resumed');
    }

    // Play each track
    audioElements.forEach((audioElement, index) => {
        audioElement.loop = true;  // Enable looping
        audioElement.play().then(() => {
            console.log(`Track ${index + 1} playback started`);
        }).catch(error => {
            console.error(`Error playing track ${index + 1}:`, error);
        });
    });
});

// Stop button event listener
document.getElementById('stop').addEventListener('click', () => {
    audioElements.forEach((audioElement, index) => {
        audioElement.pause();
        audioElement.currentTime = 0; // Reset playback to start
        console.log(`Track ${index + 1} playback stopped`);
    });
});

// Function to show the password modal
function showPasswordModal() {
    document.getElementById('password-modal').style.display = 'flex';
    console.log('Password modal displayed');
}

// Function to hide the password modal
function hidePasswordModal() {
    document.getElementById('password-modal').style.display = 'none';
    console.log('Password modal hidden');
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
        console.log('Incorrect password entered');
        return;
    }

    console.log('Correct password entered');
    hidePasswordModal();

    // Show feedback for correct password
    successMessageElement.innerText = 'Contraseña correcta. Procesando mezcla...';
    successMessageElement.style.color = 'blue';
    successMessageElement.style.display = 'block';

    // Create a destination for recording
    const destination = audioContext.createMediaStreamDestination();
    tracks.forEach((track, index) => {
        track.connect(destination);
        console.log(`Track ${index + 1} connected to recording destination`);
    });

    // Use MediaRecorder to record the output
    const recorder = new MediaRecorder(destination.stream);
    const chunks = [];

    recorder.ondataavailable = event => {
        chunks.push(event.data);
        console.log('Data chunk received from recorder');
    };

    recorder.onstop = async () => {
        console.log('Recording stopped, processing data');

        // Check if any data was recorded
        if (chunks.length === 0) {
            console.error('No data recorded');
            successMessageElement.innerText = 'Error: No se pudo grabar el audio.';
            successMessageElement.style.color = 'red';
            successMessageElement.style.display = 'block';
            return;
        }

        const blob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', blob, 'mixture.webm');
        formData.append('password', password); // Include password in formData

        // Send the audio file to the server
        console.log('Sending audio file to server');
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.text();
            console.log('Server response:', result);

            if (response.ok) {
                successMessageElement.innerText = `Tu mezcla fue guardada con éxito: ${result}`;
                successMessageElement.style.color = 'green';
                console.log('Mix saved successfully');
            } else {
                successMessageElement.innerText = 'Error al guardar la mezcla: ' + result;
                successMessageElement.style.color = 'red';
                console.error('Error saving mix:', result);
            }

            successMessageElement.style.display = 'block';
        } catch (error) {
            console.error('Fetch error:', error);
            successMessageElement.innerText = 'Error al enviar la mezcla al servidor.';
            successMessageElement.style.color = 'red';
            successMessageElement.style.display = 'block';
        }
    };

    // Start recording
    recorder.start();
    console.log('Recording started');

    // Stop recording after 10 seconds
    setTimeout(() => {
        recorder.stop();
        console.log('Recording stopped after 10 seconds');
    }, 10000);
});
