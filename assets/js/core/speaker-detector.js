/**
 * speaker-detector.js
 * DocEasy — Video Tools Project
 * Core module: Automatic Speaker Diarization & Detection
 */

class SpeakerDetector {
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 44100;
        this.vadThresholdDb = options.vadThreshold !== undefined ? options.vadThreshold : -50;
        this.minSegmentDuration = options.minSegmentDuration !== undefined ? options.minSegmentDuration : 0.3;
        this.pitchMin = options.pitchMin || 80;
        this.pitchMax = options.pitchMax || 350;
        this.yinThreshold = options.yinThreshold || 0.2;
        this.maxSpeakers = options.maxSpeakers || 5;
        this.minSpeakers = options.minSpeakers || 2;
        this.debug = options.debug || false;
        this.frameSize = Math.floor(this.sampleRate * 0.05);
    }

    async detect(audioBuffer) {
        if (!audioBuffer) throw new Error('AudioBuffer is required.');
        const channelData = audioBuffer.getChannelData(0);
        const totalFrames = Math.floor(channelData.length / this.frameSize);
        const activeFrames = [];
        
        for (let i = 0; i < totalFrames; i++) {
            const startSample = i * this.frameSize;
            const endSample = Math.min(startSample + this.frameSize, channelData.length);
            const rms = this._computeRms(channelData, startSample, endSample);
            const db = 20 * Math.log10(rms);
            const isActive = db > this.vadThresholdDb;
            activeFrames.push({ index: i, startSample, endSample, rms, db, isActive });
        }

        const segments = [];
        let currentSegment = null;

        for (let i = 0; i < activeFrames.length; i++) {
            const frame = activeFrames[i];
            if (frame.isActive) {
                const pitchData = this._yinPitch(channelData, frame.startSample, frame.endSample, this.sampleRate, this.pitchMin, this.pitchMax, this.yinThreshold);
                if (pitchData.pitch > 0 && pitchData.confidence > 0) {
                    if (!currentSegment) {
                        currentSegment = { start: frame.startSample / this.sampleRate, end: frame.endSample / this.sampleRate, pitches: [pitchData.pitch], confidences: [pitchData.confidence] };
                    } else {
                        const gapSamples = frame.startSample - (currentSegment.end * this.sampleRate);
                        const gapSeconds = gapSamples / this.sampleRate;
                        if (gapSeconds > 0.1) {
                            this._finalizeSegment(currentSegment, segments);
                            currentSegment = { start: frame.startSample / this.sampleRate, end: frame.endSample / this.sampleRate, pitches: [pitchData.pitch], confidences: [pitchData.confidence] };
                        } else {
                            currentSegment.end = frame.endSample / this.sampleRate;
                            currentSegment.pitches.push(pitchData.pitch);
                            currentSegment.confidences.push(pitchData.confidence);
                        }
                    }
                }
            } else {
                if (currentSegment) { this._finalizeSegment(currentSegment, segments); currentSegment = null; }
            }
        }
        if (currentSegment) this._finalizeSegment(currentSegment, segments);
        if (segments.length > 0) this._assignSpeakers(segments);
        return segments;
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
        segmentsArray.push({ start: segmentData.start, end: segmentData.end, pitch: avgPitch, speakerId: -1, confidence: avgConfidence });
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
        if (x0 === tauEstimate) betterTau = yinBuffer[tauEstimate] <= yinBuffer[x2] ? tauEstimate : x2;
        else if (x2 === tauEstimate) betterTau = yinBuffer[tauEstimate] <= yinBuffer[x0] ? tauEstimate : x0;
        else {
            const s0 = yinBuffer[x0], s1 = yinBuffer[tauEstimate], s2 = yinBuffer[x2];
            betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
        }
        const pitch = sampleRate / betterTau;
        const confidence = 1 - yinBuffer[tauEstimate];
        if (pitch < minFreq || pitch > maxFreq) return { pitch: 0, confidence: 0 };
        return { pitch, confidence: Math.max(0, Math.min(1, confidence)) };
    }

    _assignSpeakers(segments) {
        if (segments.length < 2) { segments.forEach(seg => seg.speakerId = 0); return; }
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
        const centroids = [data[Math.floor(Math.random() * data.length)]];
        for (let i = 1; i < k; i++) {
            const distances = data.map(x => Math.min(...centroids.map(c => Math.abs(x - c))));
            const sumDist = distances.reduce((a, b) => a + b, 0);
            let rand = Math.random() * sumDist, selectedIndex = 0;
            for (let j = 0; j < distances.length; j++) { rand -= distances[j]; if (rand <= 0) { selectedIndex = j; break; } }
            centroids.push(data[selectedIndex]);
        }
        let assignments = new Array(data.length).fill(0), iterations = 0, changed = true;
        while (changed && iterations < maxIterations) {
            changed = false; iterations++;
            for (let i = 0; i < data.length; i++) {
                let minDist = Infinity, bestCluster = 0;
                for (let j = 0; j < k; j++) { const dist = Math.abs(data[i] - centroids[j]); if (dist < minDist) { minDist = dist; bestCluster = j; } }
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

// 🌟 यह सबसे नीचे होना ज़रूरी है, ताकि मेन HTML टूल इसे पहचान सके
if (typeof self !== 'undefined') {
    self.DocEasySpeakerDetector = {
        detectSpeakers: async function({ channelData, sampleRate, numberOfChannels }) {
            const detector = new SpeakerDetector({ sampleRate: sampleRate });
            const mockAudioBuffer = {
                numberOfChannels: numberOfChannels,
                sampleRate: sampleRate,
                length: channelData[0].length,
                duration: channelData[0].length / sampleRate,
                getChannelData: (ch) => channelData[ch]
            };
            const segments = await detector.detect(mockAudioBuffer);
            const speakerIds = new Set(segments.map(s => s.speakerId));
            return { segments: segments, speakerCount: speakerIds.size };
        }
    };
    }
