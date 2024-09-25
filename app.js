// Initialize the AudioContext
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
console.log('AudioContext initialized:', audioContext);

// Arrays to store gain and pan values
const gainValues = [0.5, 0.5, 0.5, 0.5]; // Initial gain values
const panValues = [0, 0, 0, 0];          // Initial pan values

// Create gain nodes and panner nodes for each track
const gainNodes = [];
const pannerNodes = [];
const audioElements = [];
const trackFiles = ["1.wav", "2.wav", "3.wav", "4.wav"];

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
    gainNode.gain.value = gainValues[index];  // Default volume
    pannerNode.pan.value = panValues[index];   // Default pan

    // Store nodes and elements for later control
    gainNodes.push(gainNode);
    pannerNodes.push(pannerNode);
    audioElements.push(audioElement);

    // Add event listeners for volume and pan controls
    document.getElementById(`volume${index + 1}`).addEventListener('input', (event) => {
        const value = parseFloat(event.target.value);
        gainNode.gain.value = value;
        gainValues[index] = value; // Update gainValues array
        console.log(`Volume for track ${index + 1} set to:`, value);
    });

    document.getElementById(`pan${index + 1}`).addEventListener('input', (event) => {
        const value = parseFloat(event.target.value);
        pannerNode.pan.value = value;
        panValues[index] = value; // Update panValues array
        console.log(`Pan for track ${index + 1} set to:`, value);
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

// Function to show the success modal
function showSuccessModal() {
    document.getElementById('success-modal').style.display = 'flex';
    console.log('Success modal displayed');
}

// Function to hide the success modal and reset page
function hideSuccessModalAndReset() {
    document.getElementById('success-modal').style.display = 'none';
    console.log('Success modal hidden');
    resetPage(); // Reset page to default state
}

// Function to reset the page to default state
function resetPage() {
    // Stop playback
    audioElements.forEach((audioElement) => {
        audioElement.pause();
        audioElement.currentTime = 0;
    });

    // Reset sliders
    gainValues.forEach((value, index) => {
        gainNodes[index].gain.value = 0.5;  // Reset gain to default
        document.getElementById(`volume${index + 1}`).value = 0.5; // Reset slider
    });

    panValues.forEach((value, index) => {
        pannerNodes[index].pan.value = 0;   // Reset pan to default
        document.getElementById(`pan${index + 1}`).value = 0; // Reset slider
    });

    console.log('Page reset to default state');
}

// Render and save the mix
document.getElementById('render').addEventListener('click', () => {
    showPasswordModal(); // Show the modal when the render button is clicked
});

// Close modal button event listeners
document.getElementById('close-modal').addEventListener('click', hidePasswordModal);
document.getElementById('close-success-modal').addEventListener('click', hideSuccessModalAndReset);

// Validate password and proceed with rendering
document.getElementById('submit-password').addEventListener('click', async () => {
    const password = document.getElementById('password').value;
    const successMessageElement = document.getElementById('success-message');

    // Reset success message
    successMessageElement.innerText = '';

    if (password !== 'mst05072024') {
        alert('Contraseña incorrecta. No tienes permiso para guardar.');
        console.log('Incorrect password entered');
        return;
    }

    console.log('Correct password entered');
    hidePasswordModal();
    showSuccessModal(); // Show the success modal

    // Show feedback for correct password
    successMessageElement.innerText = 'Contraseña correcta, calentando motores temporales';
    successMessageElement.style.color = 'blue';

    // Stop playback if any
    audioElements.forEach((audioElement) => {
        audioElement.pause();
    });

    // Load audio buffers for rendering
    try {
        const bufferPromises = trackFiles.map((track, index) => {
            return fetch(track)
                .then(response => {
                    console.log(`Fetched ${track}, status: ${response.status}`);
                    return response.arrayBuffer();
                })
                .then(arrayBuffer => {
                    console.log(`ArrayBuffer length for ${track}: ${arrayBuffer.byteLength}`);
                    return audioContext.decodeAudioData(arrayBuffer);
                })
                .then(audioBuffer => {
                    console.log(`Audio buffer duration for track ${index + 1}: ${audioBuffer.duration}`);
                    return audioBuffer;
                })
                .catch(error => {
                    console.error(`Error loading or decoding ${track}:`, error);
                    throw error;
                });
        });

        const audioBuffers = await Promise.all(bufferPromises);

        // Verify that audioBuffers contain valid data
        audioBuffers.forEach((buffer, index) => {
            const samples = buffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < samples.length; i++) {
                sum += Math.abs(samples[i]);
            }
            console.log(`Sum of absolute sample values in audio buffer ${index + 1}: ${sum}`);
        });

        // Check if any buffer is silent
        const isSilent = audioBuffers.every(buffer => {
            const samples = buffer.getChannelData(0);
            return samples.every(sample => sample === 0);
        });

        if (isSilent) {
            console.error('All audio buffers are silent. Aborting rendering process.');
            successMessageElement.innerText = 'Error: Todos los buffers de audio están en silencio.';
            successMessageElement.style.color = 'red';
            return;
        }

        // Create an offline context for rendering
        const renderDuration = 30; // seconds
        const offlineContext = new OfflineAudioContext({
            numberOfChannels: 2,
            length: renderDuration * audioContext.sampleRate,
            sampleRate: audioContext.sampleRate,
        });

        // Show rendering status message
        successMessageElement.innerText = 'Viaje sonoro iniciado';
        successMessageElement.style.color = 'blue';

        // For each track, create a buffer source and apply volume and pan
        audioBuffers.forEach((audioBuffer, index) => {
            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;

            const gainNode = offlineContext.createGain();
            const pannerNode = offlineContext.createStereoPanner();

            // Apply current volume and pan settings from gainValues and panValues
            gainNode.gain.value = gainValues[index];
            pannerNode.pan.value = panValues[index];

            console.log(`Applying gain for track ${index + 1}: ${gainValues[index]}`);
            console.log(`Applying pan for track ${index + 1}: ${panValues[index]}`);

            // Connect nodes: source -> gain -> panner -> destination
            source.connect(gainNode).connect(pannerNode).connect(offlineContext.destination);

            // Start playback at time 0
            source.start(0);
        });

        console.log('Rendering audio...');
        const renderedBuffer = await offlineContext.startRendering();
        console.log('Audio rendering completed');

        // Check the rendered buffer
        console.log(`Rendered buffer duration: ${renderedBuffer.duration}`);
        console.log(`Rendered buffer number of channels: ${renderedBuffer.numberOfChannels}`);
        console.log(`Rendered buffer sample rate: ${renderedBuffer.sampleRate}`);

        // Convert the rendered buffer to WAV format
        const wavData = audioBufferToWav(renderedBuffer);
        console.log('WAV encoding completed');

        // Create a Blob from the WAV data
        const blob = new Blob([wavData], { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', blob, 'mixture.wav'); // Using WAV file
        formData.append('password', password); // Include password in formData

        // Send the audio file to the server
        console.log('Sending audio file to server');
        successMessageElement.innerText = 'Enviando mezcla al servidor...';

        // POST request to the server
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        // Server response
        const result = await response.text();
        console.log('Server response:', result);

        if (response.ok) {
            successMessageElement.innerText = `Felicitaciones, su viaje sonoro se ha guardado en el llavero #${result}`;
            successMessageElement.style.color = 'green';
        } else {
            successMessageElement.innerText = 'Error al guardar la mezcla: ' + result;
            successMessageElement.style.color = 'red';
        }

    } catch (error) {
        console.error('Error during audio rendering or file upload:', error);
        successMessageElement.innerText = 'Error durante el proceso de mezcla.';
        successMessageElement.style.color = 'red';
    }
});

// Function to convert AudioBuffer to WAV
function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArray = new ArrayBuffer(length),
        view = new DataView(bufferArray),
        channels = [],
        sampleRate = buffer.sampleRate,
        bitsPerSample = 16;

    // Write WAV header
    let offset = 0;
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, length - 8, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * numOfChan * bitsPerSample / 8, true); offset += 4;
    view.setUint16(offset, numOfChan * bitsPerSample / 8, true); offset += 2;
    view.setUint16(offset, bitsPerSample, true); offset += 2;
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, length - offset - 4, true); offset += 4;

    // Write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    let sample;
    for (let i = 0; i < buffer.length; i++)
        for (let ch = 0; ch < numOfChan; ch++) {
            sample = Math.max(-1, Math.min(1, channels[ch][i]));
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
            view.setInt16(offset, sample, true);
            offset += 2;
        }

    return bufferArray;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++)
        view.setUint8(offset + i, string.charCodeAt(i));
}
