/**
 * speaker-detector.js
 * 
 * DocEasy — Video Tools Project
 * Core module: Automatic Speaker Diarization & Detection
 * 
 * This module provides:
 * 1. Voice Activity Detection (VAD) using RMS energy.
 * 2. Pitch detection using the YIN algorithm (fundamental frequency 80-350Hz).
 * 3. Speaker clustering using k-means (k=2..5) with elbow method.
 * 4. Segment generation with confidence scores.
 * 
 * Worker-safe: Does not reference `window` or `document`.
 * 
 * @module SpeakerDetector
 * @version 1.0.0
 * @author DocEasy Team
 * @license MIT
 */

/**
 * @typedef {Object} SpeakerSegment
 * @property {number} start - Start time in seconds.
 * @property {number} end - End time in seconds.
 * @property {number} pitch - Average fundamental frequency (Hz) for the segment.
 * @property {number} speakerId - Assigned speaker ID (0-indexed).
 * @property {number} confidence - Detection confidence score (0.0 to 1.0).
 */

/**
 * SpeakerDetector Class
 * Pure JS implementation for detecting and separating speakers in an audio stream.
 */
class SpeakerDetector {
    /**
     * Create a SpeakerDetector.
     * @param {Object} [options] - Configuration options.
     * @param {number} [options.sampleRate=44100] - Audio sample rate.
     * @param {number} [options.vadThreshold=-40] - VAD threshold in dB (default -40dB).
     * @param {number} [options.minSegmentDuration=0.3] - Minimum voice segment duration in seconds (default 300ms).
     * @param {number} [options.pitchMin=80] - Minimum pitch frequency in Hz.
     * @param {number} [options.pitchMax=350] - Maximum pitch frequency in Hz.
     * @param {number} [options.yinThreshold=0.1] - YIN absolute threshold for pitch detection.
     * @param {number} [options.maxSpeakers=5] - Maximum number of speakers to cluster.
     * @param {number} [options.minSpeakers=2] - Minimum number of speakers to cluster.
     */
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 44100;
        this.vadThresholdDb = options.vadThreshold !== undefined ? options.vadThreshold : -40;
        this.minSegmentDuration = options.minSegmentDuration !== undefined ? options.minSegmentDuration : 0.3;
        this.pitchMin = options.pitchMin || 80;
        this.pitchMax = options.pitchMax || 350;
        this.yinThreshold = options.yinThreshold || 0.1;
        this.maxSpeakers = options.maxSpeakers || 5;
        this.minSpeakers = options.minSpeakers || 2;
        
        // Frame size for VAD (20ms)
        this.frameSize = Math.floor(this.sampleRate * 0.02);
    }

    /**
     * Detect speakers in a decoded AudioBuffer.
     * 
     * @param {AudioBuffer} audioBuffer - Decoded audio buffer.
     * @returns {Promise<SpeakerSegment[]>} Array of speaker segments.
     */
    async detect(audioBuffer) {
        if (!audioBuffer) {
            throw new Error('AudioBuffer is required for speaker detection.');
        }

        const channelData = audioBuffer.getChannelData(0); // Process mono (first channel)
        const totalFrames = Math.floor(channelData.length / this.frameSize);
        
        const activeFrames = [];
        
        // 1. Voice Activity Detection (VAD)
        for (let i = 0; i < totalFrames; i++) {
            const startSample = i * this.frameSize;
            const endSample = Math.min(startSample + this.frameSize, channelData.length);
            
            const rms = this._computeRms(channelData, startSample, endSample);
            const db = 20 * Math.log10(rms);
            
            // Check if frame is active (above threshold)
            const isActive = db > this.vadThresholdDb;
            
            activeFrames.push({
                index: i,
                startSample,
                endSample,
                rms,
                db,
                isActive
            });
        }

        // 2. Extract Pitches from active frames
        const segments = [];
        let currentSegment = null;

        for (let i = 0; i < activeFrames.length; i++) {
            const frame = activeFrames[i];
            
            if (frame.isActive) {
                // Extract pitch using YIN
                const pitchData = this._yinPitch(
                    channelData, 
                    frame.startSample, 
                    frame.endSample, 
                    this.sampleRate, 
                    this.pitchMin, 
                    this.pitchMax,
                    this.yinThreshold
                );

                if (pitchData.pitch > 0 && pitchData.confidence > 0) {
                    if (!currentSegment) {
                        currentSegment = {
                            start: frame.startSample / this.sampleRate,
                            end: frame.endSample / this.sampleRate,
                            pitches: [pitchData.pitch],
                            confidences: [pitchData.confidence]
                        };
                    } else {
                        // Check for gap (if more than 100ms silence, split segment)
                        const gapSamples = frame.startSample - (currentSegment.end * this.sampleRate);
                        const gapSeconds = gapSamples / this.sampleRate;
                        
                        if (gapSeconds > 0.1) {
                            // Finalize previous segment
                            this._finalizeSegment(currentSegment, segments);
                            // Start new segment
                            currentSegment = {
                                start: frame.startSample / this.sampleRate,
                                end: frame.endSample / this.sampleRate,
                                pitches: [pitchData.pitch],
                                confidences: [pitchData.confidence]
                            };
                        } else {
                            // Extend current segment
                            currentSegment.end = frame.endSample / this.sampleRate;
                            currentSegment.pitches.push(pitchData.pitch);
                            currentSegment.confidences.push(pitchData.confidence);
                        }
                    }
                }
            } else {
                // Inactive frame, finalize segment if exists
                if (currentSegment) {
                    this._finalizeSegment(currentSegment, segments);
                    currentSegment = null;
                }
            }
        }

        // Finalize last segment
        if (currentSegment) {
            this._finalizeSegment(currentSegment, segments);
        }

        // 3. Cluster Speakers
        if (segments.length > 0) {
            this._assignSpeakers(segments);
        }

        return segments;
    }

    /**
     * Detect speakers from a MediaStream.
     * Note: This method captures the stream into a buffer first. For real-time processing,
     * this should be adapted to use an AudioWorklet.
     * 
     * @param {MediaStream} mediaStream - The audio MediaStream.
     * @param {number} [duration=10] - Duration to capture in seconds (default 10s for analysis).
     * @returns {Promise<SpeakerSegment[]>} Array of speaker segments.
     */
    async detectFromStream(mediaStream, duration = 10) {
        if (!mediaStream) {
            throw new Error('MediaStream is required.');
        }

        // Check if AudioContext is available (Worker-safe check)
        const AudioContextClass = typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);
        
        if (!AudioContextClass) {
            throw new Error('AudioContext is not supported in this environment. Cannot process MediaStream.');
        }

        const audioContext = new AudioContextClass({ sampleRate: this.sampleRate });
        const source = audioContext.createMediaStreamSource(mediaStream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        const chunks = [];
        
        return new Promise((resolve, reject) => {
            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                chunks.push(new Float32Array(inputData));
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            setTimeout(async () => {
                processor.disconnect();
                source.disconnect();
                audioContext.close();

                // Merge chunks
                const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                const merged = new Float32Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    merged.set(chunk, offset);
                    offset += chunk.length;
                }

                // Create an AudioBuffer from merged data
                const buffer = audioContext.createBuffer(1, merged.length, this.sampleRate);
                buffer.copyToChannel(merged, 0);

                resolve(await this.detect(buffer));
            }, duration * 1000);
        });
    }

    /**
     * Compute Root Mean Square (RMS) for a given sample range.
     * @private
     */
    _computeRms(buffer, start, end) {
        let sum = 0;
        for (let i = start; i < end; i++) {
            sum += buffer[i] * buffer[i];
        }
        return Math.sqrt(sum / (end - start));
    }

    /**
     * Finalize a segment by calculating average pitch and confidence, then push to segments array.
     * @private
     */
    _finalizeSegment(segmentData, segmentsArray) {
        const duration = segmentData.end - segmentData.start;
        
        // Filter out segments shorter than minSegmentDuration (default 300ms)
        if (duration < this.minSegmentDuration) {
            return;
        }

        const avgPitch = segmentData.pitches.reduce((a, b) => a + b, 0) / segmentData.pitches.length;
        const avgConfidence = segmentData.confidences.reduce((a, b) => a + b, 0) / segmentData.confidences.length;

        segmentsArray.push({
            start: segmentData.start,
            end: segmentData.end,
            pitch: avgPitch,
            speakerId: -1, // To be assigned in clustering
            confidence: avgConfidence
        });
    }

    /**
     * YIN Pitch Detection Algorithm implementation.
     * 
     * @private
     * @param {Float32Array} buffer - Audio buffer.
     * @param {number} startSample - Start sample index.
     * @param {number} endSample - End sample index.
     * @param {number} sampleRate - Sample rate.
     * @param {number} minFreq - Minimum pitch frequency (Hz).
     * @param {number} maxFreq - Maximum pitch frequency (Hz).
     * @param {number} threshold - YIN absolute threshold.
     * @returns {{pitch: number, confidence: number}} Detected pitch and confidence.
     */
    _yinPitch(buffer, startSample, endSample, sampleRate, minFreq, maxFreq, threshold) {
        const length = endSample - startSample;
        
        // We need enough samples for pitch detection. At least 2 periods of minFreq.
        const minPeriod = Math.floor(sampleRate / maxFreq);
        const maxPeriod = Math.floor(sampleRate / minFreq);
        
        if (length < maxPeriod * 2) {
            // Not enough samples for reliable pitch detection
            return { pitch: 0, confidence: 0 };
        }

        const yinBuffer = new Float32Array(maxPeriod);

        // 1. Difference function
        for (let tau = 0; tau < maxPeriod; tau++) {
            let sum = 0;
            for (let j = 0; j < length - maxPeriod; j++) {
                const delta = buffer[startSample + j] - buffer[startSample + j + tau];
                sum += delta * delta;
            }
            yinBuffer[tau] = sum;
        }

        // 2. Cumulative mean normalized difference function
        yinBuffer[0] = 1;
        let runningSum = 0;
        for (let tau = 1; tau < maxPeriod; tau++) {
            runningSum += yinBuffer[tau];
            yinBuffer[tau] = yinBuffer[tau] * tau / runningSum;
        }

        // 3. Absolute threshold
        let tauEstimate = -1;
        for (let tau = minPeriod; tau < maxPeriod; tau++) {
            if (yinBuffer[tau] < threshold) {
                while (tau + 1 < maxPeriod && yinBuffer[tau + 1] < yinBuffer[tau]) {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }

        if (tauEstimate === -1) {
            return { pitch: 0, confidence: 0 };
        }

        // 4. Parabolic interpolation
        let betterTau;
        const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
        const x2 = tauEstimate + 1 < maxPeriod ? tauEstimate + 1 : tauEstimate;
        
        if (x0 === tauEstimate) {
            betterTau = yinBuffer[tauEstimate] <= yinBuffer[x2] ? tauEstimate : x2;
        } else if (x2 === tauEstimate) {
            betterTau = yinBuffer[tauEstimate] <= yinBuffer[x0] ? tauEstimate : x0;
        } else {
            const s0 = yinBuffer[x0];
            const s1 = yinBuffer[tauEstimate];
            const s2 = yinBuffer[x2];
            betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
        }

        const pitch = sampleRate / betterTau;
        const confidence = 1 - yinBuffer[tauEstimate]; // Confidence is inversely proportional to YIN error

        // Validate frequency range
        if (pitch < minFreq || pitch > maxFreq) {
            return { pitch: 0, confidence: 0 };
        }

        return { pitch, confidence: Math.max(0, Math.min(1, confidence)) };
    }

    /**
     * Assign speaker IDs to segments using K-Means clustering and the Elbow method.
     * 
     * @private
     * @param {SpeakerSegment[]} segments - Array of finalized segments.
     */
    _assignSpeakers(segments) {
        if (segments.length < 2) {
            segments.forEach(seg => seg.speakerId = 0);
            return;
        }

        const pitches = segments.map(seg => seg.pitch);

        // Find optimal k using Elbow method
        let optimalK = this.minSpeakers;
        let maxDrop = 0;
        let prevWcss = null;

        for (let k = this.minSpeakers; k <= this.maxSpeakers; k++) {
            if (k >= segments.length) break;

            const { wcss } = this._kmeans(pitches, k);
            
            if (prevWcss !== null) {
                const drop = prevWcss - wcss;
                if (drop > maxDrop) {
                    maxDrop = drop;
                    optimalK = k;
                }
            }
            prevWcss = wcss;
        }

        // Run K-Means with optimal K
        const { assignments } = this._kmeans(pitches, optimalK);

        // Assign speakerId to segments
        segments.forEach((seg, index) => {
            seg.speakerId = assignments[index];
        });
    }

    /**
     * Simple 1D K-Means clustering.
     * 
     * @private
     * @param {number[]} data - Array of pitch values.
     * @param {number} k - Number of clusters.
     * @returns {{centroids: number[], assignments: number[], wcss: number}}
     */
    _kmeans(data, k, maxIterations = 100) {
        // Initialize centroids using k-means++ style
        const centroids = [];
        centroids.push(data[Math.floor(Math.random() * data.length)]);
        
        for (let i = 1; i < k; i++) {
            const distances = data.map(x => Math.min(...centroids.map(c => Math.abs(x - c))));
            const sumDist = distances.reduce((a, b) => a + b, 0);
            let rand = Math.random() * sumDist;
            let selectedIndex = 0;
            for (let j = 0; j < distances.length; j++) {
                rand -= distances[j];
                if (rand <= 0) {
                    selectedIndex = j;
                    break;
                }
            }
            centroids.push(data[selectedIndex]);
        }

        let assignments = new Array(data.length).fill(0);
        let iterations = 0;
        let changed = true;

        while (changed && iterations < maxIterations) {
            changed = false;
            iterations++;

            // Assign points to nearest centroid
            for (let i = 0; i < data.length; i++) {
                let minDist = Infinity;
                let bestCluster = 0;
                for (let j = 0; j < k; j++) {
                    const dist = Math.abs(data[i] - centroids[j]);
                    if (dist < minDist) {
                        minDist = dist;
                        bestCluster = j;
                    }
                }
                if (assignments[i] !== bestCluster) {
                    assignments[i] = bestCluster;
                    changed = true;
                }
            }

            // Update centroids
            const sums = new Array(k).fill(0);
            const counts = new Array(k).fill(0);
            for (let i = 0; i < data.length; i++) {
                sums[assignments[i]] += data[i];
                counts[assignments[i]]++;
            }
            for (let j = 0; j < k; j++) {
                if (counts[j] > 0) {
                    centroids[j] = sums[j] / counts[j];
                }
            }
        }

        // Calculate WCSS (Within-Cluster Sum of Squares)
        let wcss = 0;
        for (let i = 0; i < data.length; i++) {
            wcss += Math.pow(data[i] - centroids[assignments[i]], 2);
        }

        return { centroids, assignments, wcss };
    }
}

// Export for Web Worker and Module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpeakerDetector;
} else {
    self.SpeakerDetector = SpeakerDetector;
}
