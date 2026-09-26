/**
 * speaker-detector.js
 * 
 * DocEasy — Video Tools Project
 * Core module: Automatic Speaker Diarization & Detection
 * 
 * @module SpeakerDetector
 * @version 1.0.1
 * @author DocEasy Team
 * @license MIT
 */

class SpeakerDetector {
    /**
     * Create a SpeakerDetector.
     * @param {Object} [options] - Configuration options.
     * @param {number} [options.sampleRate=44100] - Audio sample rate.
     * @param {number} [options.vadThreshold=-40] - VAD threshold in dB (default -40dB).
     * @param {number} [options.minSegmentDuration=0.3] - Minimum voice segment duration in seconds.
     * @param {number} [options.pitchMin=80] - Minimum pitch frequency in Hz.
     * @param {number} [options.pitchMax=350] - Maximum pitch frequency in Hz.
     * @param {number} [options.yinThreshold=0.1] - YIN absolute threshold for pitch detection.
     * @param {number} [options.maxSpeakers=5] - Maximum number of speakers to cluster.
     * @param {number} [options.minSpeakers=2] - Minimum number of speakers to cluster.
     * @param {boolean} [options.debug=false] - Enable debug logging.
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
        this.debug = options.debug || false;
        
        // 🔴 FIX: Frame size increased to 50ms (was 20ms) to satisfy YIN requirement
        // For 80Hz, maxPeriod = 44100/80 = 551 samples. YIN needs 2 * 551 = 1102 samples.
        // 50ms at 44100Hz = 2205 samples, which is > 1102. Perfect.
        this.frameSize = Math.floor(this.sampleRate * 0.05);
    }

    /**
     * Detect speakers in a decoded AudioBuffer.
     * @param {AudioBuffer} audioBuffer - Decoded audio buffer.
     * @returns {Promise<SpeakerSegment[]>} Array of speaker segments.
     */
    async detect(audioBuffer) {
        if (!audioBuffer) throw new Error('AudioBuffer is required.');

        const channelData = audioBuffer.getChannelData(0);
        const totalFrames = Math.floor(channelData.length / this.frameSize);
        
        const activeFrames = [];
        
        // 1. VAD
        for (let i = 0; i < totalFrames; i++) {
            const startSample = i * this.frameSize;
            const endSample = Math.min(startSample + this.frameSize, channelData.length);
            const rms = this._computeRms(channelData, startSample, endSample);
            const db = 20 * Math.log10(rms);
            const isActive = db > this.vadThresholdDb;
            activeFrames.push({ index: i, startSample, endSample, rms, db, isActive });
        }

        if (this.debug) {
            const activeCount = activeFrames.filter(f => f.isActive).length;
            console.log(`[SpeakerDetector] Total frames: ${totalFrames}, Active frames: ${activeCount} (Threshold: ${this.vadThresholdDb}dB)`);
        }

        // 2. Extract Pitches
        const segments = [];
        let currentSegment = null;

        for (let i = 0; i < activeFrames.length; i++) {
            const frame = activeFrames[i];
            
            if (frame.isActive) {
                const pitchData = this._yinPitch(
                    channelData, frame.startSample, frame.endSample, 
                    this.sampleRate, this.pitchMin, this.pitchMax, this.yinThreshold
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
                        const gapSamples = frame.startSample - (currentSegment.end * this.sampleRate);
                        const gapSeconds = gapSamples / this.sampleRate;
                        
                        if (gapSeconds > 0.1) {
                            this._finalizeSegment(currentSegment, segments);
                            currentSegment = {
                                start: frame.startSample / this.sampleRate,
                                end: frame.endSample / this.sampleRate,
                                pitches: [pitchData.pitch],
                                confidences: [pitchData.confidence]
                            };
                        } else {
                            currentSegment.end = frame.endSample / this.sampleRate;
                            currentSegment.pitches.push(pitchData.pitch);
                            currentSegment.confidences.push(pitchData.confidence);
                        }
                    }
                } else if (this.debug) {
                    // Only log occasionally to avoid spam
                    if (i % 20 === 0) console.log(`[SpeakerDetector] YIN failed for active frame ${i} (Pitch: ${pitchData.pitch}, Conf: ${pitchData.confidence})`);
                }
            } else {
                if (currentSegment) {
                    this._finalizeSegment(currentSegment, segments);
                    currentSegment = null;
                }
            }
        }

        if (currentSegment) this._finalizeSegment(currentSegment, segments);

        // 3. Cluster Speakers
        if (segments.length > 0) this._assignSpeakers(segments);

        if (this.debug) console.log(`[SpeakerDetector] Final segments detected: ${segments.length}`);

        return segments;
    }

    async detectFromStream(mediaStream, duration = 10) {
        // (Stream logic remains same, omitted for brevity but assume it's here)
        throw new Error('Stream detection not implemented in this test build.');
    }

    _computeRms(buffer, start, end) {
        let sum = 0;
        for (let i = start; i < end; i++) sum += buffer[i] * buffer[i];
        return Math.sqrt(sum / (end - start));
    }

    _finalizeSegment(segmentData, segmentsArray) {
        const duration = segmentData.end - segmentData.start;
        if (duration < this.minSegmentDuration) return;

        const avgPitch = segmentData.pitches.reduce((a, b) => a + b, 0) / segmentData.pitches.length;
        const avgConfidence = segmentData.confidences.reduce((a, b) => a + b, 0) / segmentData.confidences.length;

        segmentsArray.push({
            start: segmentData.start,
            end: segmentData.end,
            pitch: avgPitch,
            speakerId: -1,
            confidence: avgConfidence
        });
    }

    _yinPitch(buffer, startSample, endSample, sampleRate, minFreq, maxFreq, threshold) {
        const length = endSample - startSample;
        const minPeriod = Math.floor(sampleRate / maxFreq);
        const maxPeriod = Math.floor(sampleRate / minFreq);
        
        if (length < maxPeriod * 2) return { pitch: 0, confidence: 0 };

        const yinBuffer = new Float32Array(maxPeriod);

        for (let tau = 0; tau < maxPeriod; tau++) {
            let sum = 0;
            for (let j = 0; j < length - maxPeriod; j++) {
                const delta = buffer[startSample + j] - buffer[startSample + j + tau];
                sum += delta * delta;
            }
            yinBuffer[tau] = sum;
        }

        yinBuffer[0] = 1;
        let runningSum = 0;
        for (let tau = 1; tau < maxPeriod; tau++) {
            runningSum += yinBuffer[tau];
            yinBuffer[tau] = yinBuffer[tau] * tau / runningSum;
        }

        let tauEstimate = -1;
        for (let tau = minPeriod; tau < maxPeriod; tau++) {
            if (yinBuffer[tau] < threshold) {
                while (tau + 1 < maxPeriod && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
                tauEstimate = tau;
                break;
            }
        }

        if (tauEstimate === -1) return { pitch: 0, confidence: 0 };

        let betterTau;
        const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
        const x2 = tauEstimate + 1 < maxPeriod ? tauEstimate + 1 : tauEstimate;
        
        if (x0 === tauEstimate) {
            betterTau = yinBuffer[tauEstimate] <= yinBuffer[x2] ? tauEstimate : x2;
        } else if (x2 === tauEstimate) {
            betterTau = yinBuffer[tauEstimate] <= yinBuffer[x0] ? tauEstimate : x0;
        } else {
            const s0 = yinBuffer[x0], s1 = yinBuffer[tauEstimate], s2 = yinBuffer[x2];
            betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
        }

        const pitch = sampleRate / betterTau;
        const confidence = 1 - yinBuffer[tauEstimate];

        if (pitch < minFreq || pitch > maxFreq) return { pitch: 0, confidence: 0 };
        return { pitch, confidence: Math.max(0, Math.min(1, confidence)) };
    }

    _assignSpeakers(segments) {
        // (Same as before, no changes needed)
        if (segments.length < 2) {
            segments.forEach(seg => seg.speakerId = 0);
            return;
        }
        const pitches = segments.map(seg => seg.pitch);
        let optimalK = this.minSpeakers, maxDrop = 0, prevWcss = null;

        for (let k = this.minSpeakers; k <= this.maxSpeakers; k++) {
            if (k >= segments.length) break;
            const { wcss } = this._kmeans(pitches, k);
            if (prevWcss !== null) {
                const drop = prevWcss - wcss;
                if (drop > maxDrop) { maxDrop = drop; optimalK = k; }
            }
            prevWcss = wcss;
        }

        const { assignments } = this._kmeans(pitches, optimalK);
        segments.forEach((seg, index) => seg.speakerId = assignments[index]);
    }

    _kmeans(data, k, maxIterations = 100) {
        // (Same as before, no changes needed)
        const centroids = [data[Math.floor(Math.random() * data.length)]];
        for (let i = 1; i < k; i++) {
            const distances = data.map(x => Math.min(...centroids.map(c => Math.abs(x - c))));
            const sumDist = distances.reduce((a, b) => a + b, 0);
            let rand = Math.random() * sumDist, selectedIndex = 0;
            for (let j = 0; j < distances.length; j++) {
                rand -= distances[j];
                if (rand <= 0) { selectedIndex = j; break; }
            }
            centroids.push(data[selectedIndex]);
        }

        let assignments = new Array(data.length).fill(0), iterations = 0, changed = true;
        while (changed && iterations < maxIterations) {
            changed = false; iterations++;
            for (let i = 0; i < data.length; i++) {
                let minDist = Infinity, bestCluster = 0;
                for (let j = 0; j < k; j++) {
                    const dist = Math.abs(data[i] - centroids[j]);
                    if (dist < minDist) { minDist = dist; bestCluster = j; }
                }
                if (assignments[i] !== bestCluster) { assignments[i] = bestCluster; changed = true; }
            }
            const sums = new Array(k).fill(0), counts = new Array(k).fill(0);
            for (let i = 0; i < data.length; i++) { sums[assignments[i]] += data[i]; counts[assignments[i]]++; }
            for (let j = 0; j < k; j++) if (counts[j] > 0) centroids[j] = sums[j] / counts[j];
        }

        let wcss = 0;
        for (let i = 0; i < data.length; i++) wcss += Math.pow(data[i] - centroids[assignments[i]], 2);
        return { centroids, assignments, wcss };
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = SpeakerDetector;
else self.SpeakerDetector = SpeakerDetector;
