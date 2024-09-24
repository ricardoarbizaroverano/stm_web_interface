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
    successMessageElement.innerText = 'Contraseña correcta, calentando motores temporales';
    successMessageElement.style.color = 'blue';
    successMessageElement.style.display = 'block';

    // Stop playback if any
    audioElements.forEach((audioElement) => {
        audioElement.pause();
    });

    // Load audio buffers for rendering
    try {
        const bufferPromises = trackFiles.map((track, index) => {
            return fetch(track)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
                .then(audioBuffer => {
                    console.log(`Audio buffer loaded for track ${index + 1}`);
                    return audioBuffer;
                });
        });

        const audioBuffers = await Promise.all(bufferPromises);

        // Create an offline context for rendering
        const offlineContext = new OfflineAudioContext({
            numberOfChannels: 2,
            length: audioContext.sampleRate * 30, // 30 seconds duration
            sampleRate: audioContext.sampleRate,
        });

        // Show rendering status message
        successMessageElement.innerText = 'Viaje sonoro iniciado';
        successMessageElement.style.color = 'blue';

        // Create an array to hold source nodes
        const sourceNodes = [];

        // Current time in the offline context
        const renderDuration = 30; // seconds
        const fadeDuration = 2; // seconds

        // For each track, create a buffer source and apply volume and pan
        audioBuffers.forEach((audioBuffer, index) => {
            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;

            const gainNode = offlineContext.createGain();
            const pannerNode = offlineContext.createStereoPanner();

            // Apply current volume and pan settings
            gainNode.gain.value = gainNodes[index].gain.value;
            pannerNode.pan.value = pannerNodes[index].pan.value;

            // Connect nodes: source -> gain -> panner -> destination
            source.connect(gainNode).connect(pannerNode).connect(offlineContext.destination);

            // Start playback at time 0
            source.start(0);

            // Apply fade-in and fade-out
            gainNode.gain.setValueAtTime(0, 0); // Start at 0 volume
            gainNode.gain.linearRampToValueAtTime(gainNodes[index].gain.value, fadeDuration); // Fade-in
            gainNode.gain.setValueAtTime(gainNodes[index].gain.value, renderDuration - fadeDuration); // Hold volume
            gainNode.gain.linearRampToValueAtTime(0, renderDuration); // Fade-out

            sourceNodes.push(source);
        });

        console.log('Rendering audio...');
        const renderedBuffer = await offlineContext.startRendering();
        console.log('Audio rendering completed');

        // Encode the rendered buffer to MP3 using lamejs
        console.log('Encoding audio to MP3...');
        const mp3Data = await encodeMp3(renderedBuffer);
        console.log('MP3 encoding completed');

        // Create a Blob from the MP3 data
        const blob = new Blob(mp3Data, { type: 'audio/mp3' });
        const formData = new FormData();
        formData.append('file', blob, 'mixture.mp3');
        formData.append('password', password); // Include password in formData

        // Send the audio file to the server
        console.log('Sending audio file to server');
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });

            const result = await response.text();
            console.log('Server response:', result);

            if (response.ok) {
                // Extract the mix number from the result
                const match = result.match(/stm_mix_(\d+)\.mp3 uploaded successfully\./);
                const mixNumber = match ? match[1] : '1';

                successMessageElement.innerText = `Felicitaciones, su viaje sonoro se ha guardado en el llavero #${mixNumber}`;
                successMessageElement.style.color = 'green';
                console.log('Mix saved successfully');
            } else {
                successMessageElement.innerText = 'Tuvimos un error al subir el archivo, intente nuevamente.';
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
    } catch (error) {
        console.error('Error during rendering:', error);
        successMessageElement.innerText = 'Error al renderizar el audio.';
        successMessageElement.style.color = 'red';
        successMessageElement.style.display = 'block';
    }
});

// Function to encode audio buffer to MP3 using lamejs
async function encodeMp3(renderedBuffer) {
    return new Promise((resolve, reject) => {
        try {
            const numChannels = renderedBuffer.numberOfChannels;
            const sampleRate = renderedBuffer.sampleRate;
            const bitrate = 128;

            const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
            const samplesLeft = renderedBuffer.getChannelData(0);
            const samplesRight = numChannels > 1 ? renderedBuffer.getChannelData(1) : null;

            const sampleBlockSize = 1152;
            const mp3Data = [];

            for (let i = 0; i < samplesLeft.length; i += sampleBlockSize) {
                const leftChunk = samplesLeft.subarray(i, i + sampleBlockSize);
                let mp3buf;

                if (samplesRight) {
                    const rightChunk = samplesRight.subarray(i, i + sampleBlockSize);
                    mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                } else {
                    mp3buf = mp3encoder.encodeBuffer(leftChunk);
                }

                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
            }

            const endBuf = mp3encoder.flush();
            if (endBuf.length > 0) {
                mp3Data.push(endBuf);
            }

            resolve(mp3Data);
        } catch (error) {
            console.error('Error encoding MP3:', error);
            reject(error);
        }
    });
}
