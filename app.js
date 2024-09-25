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
const trackFiles = ["1.mp3", "2.mp3", "3.mp3", "4.mp3"];

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

// Function to hide the success modal
function hideSuccessModal() {
    document.getElementById('success-modal').style.display = 'none';
    console.log('Success modal hidden');
}

// Render and save the mix
document.getElementById('render').addEventListener('click', () => {
    showPasswordModal(); // Show the modal when the render button is clicked
});

// Close modal button event listeners
document.getElementById('close-modal').addEventListener('click', hidePasswordModal);
document.getElementById('close-success-modal').addEventListener('click', hideSuccessModal);

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

        const sampleDataLeft = renderedBuffer.getChannelData(0);
        const sampleDataRight = renderedBuffer.getChannelData(1);
        let sumLeft = 0;
        let sumRight = 0;
        for (let i = 0; i < sampleDataLeft.length; i++) {
            sumLeft += Math.abs(sampleDataLeft[i]);
            sumRight += Math.abs(sampleDataRight[i]);
        }
        console.log(`Sum of absolute sample values in rendered buffer (Left): ${sumLeft}`);
        console.log(`Sum of absolute sample values in rendered buffer (Right): ${sumRight}`);

        // Play the rendered buffer in the browser for testing
        playRenderedBuffer(renderedBuffer);

        // Encode the rendered buffer to WAV format and play it
        console.log('Encoding audio to WAV...');
        const wavBlob = bufferToWav(renderedBuffer);
        const wavUrl = URL.createObjectURL(wavBlob);

        // Play the WAV file in the browser
        const wavAudio = new Audio(wavUrl);
        wavAudio.play();
        console.log('Playing encoded WAV in browser for testing');

        // Proceed with MP3 encoding using lame.all.js
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
        successMessageElement.innerText = 'Enviando mezcla al servidor...';

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
        } catch (error) {
            console.error('Fetch error:', error);
            successMessageElement.innerText = 'Error al enviar la mezcla al servidor.';
            successMessageElement.style.color = 'red';
        }
    } catch (error) {
        console.error('Error during rendering:', error);
        successMessageElement.innerText = 'Error al renderizar el audio.';
        successMessageElement.style.color = 'red';
    }
});

// Function to play the rendered buffer in the browser
function playRenderedBuffer(buffer) {
    // Create a buffer source
    const playbackSource = audioContext.createBufferSource();
    playbackSource.buffer = buffer;

    // Connect to the destination (speakers)
    playbackSource.connect(audioContext.destination);

    // Start playback
    playbackSource.start(0);
    console.log('Playing rendered buffer in browser');
}

// Function to encode audio buffer to WAV format
function bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numFrames = buffer.length;

    const wavBuffer = new ArrayBuffer(44 + numFrames * numChannels * 2);
    const view = new DataView(wavBuffer);

    // Write WAV container
    let offset = 0;

    // RIFF chunk descriptor
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + numFrames * numChannels * 2, true); offset += 4; // file length - 8
    writeString(view, offset, 'WAVE'); offset += 4;

    // FMT sub-chunk
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4; // SubChunk1Size (16 for PCM)
    view.setUint16(offset, 1, true); offset += 2;  // AudioFormat (1 for PCM)
    view.setUint16(offset, numChannels, true); offset += 2; // NumChannels
    view.setUint32(offset, sampleRate, true); offset += 4; // SampleRate
    view.setUint32(offset, sampleRate * numChannels * 2, true); offset += 4; // ByteRate
    view.setUint16(offset, numChannels * 2, true); offset += 2; // BlockAlign
    view.setUint16(offset, 16, true); offset += 2; // BitsPerSample

    // Data sub-chunk
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, numFrames * numChannels * 2, true); offset += 4; // SubChunk2Size

    // Write interleaved PCM samples
    let interleaved = new Int16Array(numFrames * numChannels);
    let index = 0;
    for (let i = 0; i < numFrames; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = buffer.getChannelData(channel)[i];
            const intSample = Math.max(-1, Math.min(1, sample)) * 32767;
            interleaved[index++] = intSample;
        }
    }

    for (let i = 0; i < interleaved.length; i++, offset += 2) {
        view.setInt16(offset, interleaved[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Function to encode audio buffer to MP3 using lamejs
async function encodeMp3(renderedBuffer) {
    return new Promise((resolve, reject) => {
        try {
            const numChannels = renderedBuffer.numberOfChannels;
            const sampleRate = renderedBuffer.sampleRate;
            const bitrate = 128;

            console.log(`Encoding with ${numChannels} channels at ${sampleRate} Hz`);

            const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
            const samplesLeft = renderedBuffer.getChannelData(0);
            const samplesRight = numChannels > 1 ? renderedBuffer.getChannelData(1) : null;

            console.log(`Samples length: ${samplesLeft.length}`);

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

                // Log progress every 100 chunks
                if (i % (sampleBlockSize * 100) === 0) {
                    console.log(`Encoded ${i} samples`);
                }
            }

            const endBuf = mp3encoder.flush();
            if (endBuf.length > 0) {
                mp3Data.push(endBuf);
            }

            console.log('MP3 encoding completed successfully');
            resolve(mp3Data);
        } catch (error) {
            console.error('Error during MP3 encoding:', error);
            reject(error);
        }
    });
}
