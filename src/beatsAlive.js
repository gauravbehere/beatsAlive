/**
 * BeatsAlive.jS
 * Copyright (c) 2014 Gaurav Behere
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */





window.AudioContext = window.AudioContext || window.webkitAudioContext;
var context = new AudioContext();

var audioAnimation, audioBuffer, source,sourceNode, analyser, audio, rectSVG,
highPassFilter, lowPassFilter, gainFilter, storedVol = 1, progressTimer = null,
playList = [], indexPlaying = -1, audioOver = false, gainNode = null,
equalizer80Hz = null, equalizer240Hz = null, equalizer750Hz = null,
equalizer2200Hz = null, equalizer6000Hz = null, eqInitiated = false,
requestAnimId = null, repeat = false, audio_paused_stopped = false;


/**
 * Method: loadSong
 * Sets up audio element's source, invokes audio node's setup
 * @param url
 */
function loadSong(url) {
    if (audio) audio.remove();
    if (sourceNode) sourceNode.disconnect();

    audio = new Audio();
    audio.src = url;
    audio.volume = document.getElementById('vol').value;
    audio.addEventListener("canplay", function (e) {
        setupAudioNodes();
    }, false);
};


/**
 * Initiates equalizer with preset as flat
 */
function initEQFilters() {
    // initialize eqFilters
    equalizer80Hz = context.createBiquadFilter();
    equalizer80Hz.type = 5;
    equalizer80Hz.gain.value = 0;
    equalizer80Hz.Q.value = 1;
    equalizer80Hz.frequency.value = 80;

    equalizer240Hz = context.createBiquadFilter();
    equalizer240Hz.type = 5;
    equalizer240Hz.gain.value = 0;
    equalizer240Hz.Q.value = 1;
    equalizer240Hz.frequency.value = 240;

    equalizer750Hz = context.createBiquadFilter();
    equalizer750Hz.type = 5;
    equalizer750Hz.gain.value = 0;
    equalizer750Hz.Q.value = 1;
    equalizer750Hz.frequency.value = 750;

    equalizer2200Hz = context.createBiquadFilter();
    equalizer2200Hz.type = 5;
    equalizer2200Hz.gain.value = 0;
    equalizer2200Hz.Q.value = 1;
    equalizer2200Hz.frequency.value = 2200;

    equalizer6000Hz = context.createBiquadFilter();
    equalizer6000Hz.type = 5;
    equalizer6000Hz.gain.value = 0;
    equalizer6000Hz.Q.value = 1;
    equalizer6000Hz.frequency.value = 6000;
    eqInitiated = true;
};


/**
 * Connects equalizer, gain, spectrum with the audio node
 */
function setupAudioNodes() {
    analyser = (analyser || context.createAnalyser());
    source = context.createBufferSource();
    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 512;

    gainNode = context.createGain();
    gainNode.gain.value = 1;
    try {
        sourceNode = context.createMediaElementSource(audio);
    }
    catch (e) {
        return;
    }
    if (eqInitiated == false)
        initEQFilters();

    sourceNode.connect(gainNode);
    gainNode.connect(equalizer80Hz);
    equalizer80Hz.connect(equalizer240Hz);
    equalizer240Hz.connect(equalizer750Hz);
    equalizer750Hz.connect(equalizer2200Hz);
    equalizer2200Hz.connect(equalizer6000Hz);
    equalizer6000Hz.connect(context.destination)

    sourceNode.connect(analyser);
    sourceNode.connect(context.destination);
    audio.play();
    document.getElementById('play').classList.add('focus');
    createSpectrum();

    //bind(context);
};


/**
 * Initialises visual spectrum - D3 settings
 */
function createSpectrum() {
    if (document.getElementById('rectSVG')) {
        document.getElementById('rectSVG').parentNode.removeChild(document.getElementById('rectSVG'));
    }
    rectSVG = d3.select("body").append("svg")
        .attr("width", '150%')
        .attr("height", '40%').attr("id", "rectSVG")
    var initArr = [];
    for (var i = 0; i < 256; i++) {
        initArr[initArr.length] = 0;
    }
    var selection = rectSVG.selectAll('rect').data(initArr);
    selection.enter().append('rect').attr('y', 100).attr('x', function (d, i) {
        return i * 40;
    }).attr('height', function (d, i) {
        return d
    }).attr('width', 20).style('fill', 'steelblue');
    selection.exit().remove();

    document.getElementById('progress').setAttribute('max', audio.duration);
    drawSpectrum();
    progressTimer = setInterval("trackChange();", 100);
};


/**
 * Parsing of audio buffer and filling up D3's SVG bars
 * with colors happens here
 * @param flag
 */
function getArrayAndFillSVG(flag) {
    var array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    if (flag == 0) {
        for (var i = 0; i < 256; i++) {
            array[i] = 0;
        }
    }
    var selection = rectSVG.selectAll('rect').data(array)
    selection.transition().duration(0).attr('y', 100).attr('x', function (d, i) {
        return i * 20;
    }).attr('height', function (d, i) {
        return d * 0.75;
    }).attr('width', 13).style('fill', function (d, i) {
        if (i < 20)
            return  "url(#red)";
        if (i < 40)
            return  "url(#yellow)";
        if (i < 60)
            return  "url(#blue)";
        if (i < 80)
            return  "url(#pink)";
        else
            return  "url(#grad2)";
    });

};


/**
 * Invokes getArrayAndFillSVG conditionally based on audio
 * progress and state
 */
function drawSpectrum() {
    if (audio.currentTime >= audio.duration) {
        if (playList[indexPlaying + 1]) {
            getArrayAndFillSVG(0);
            playAudio();
            return;
        }
        else {
            if (repeat == true) {
                getArrayAndFillSVG(0);
                indexPlaying = -1;
                playAudio();
            }
            else {
                clearInterval(progressTimer);
                audioOver = true;
                getArrayAndFillSVG(0);
                return;
            }
        }
    }
    audioOver = false;
    getArrayAndFillSVG();
    requestAnimId = requestAnimationFrame(drawSpectrum);
};


/**
 * Volume change event handler
 * @param e
 */
function volumeChange(e) {
    audio.volume = document.getElementById('vol').value;
};


/**
 * High pass filter -- Not used in the application
 * @param e
 */
function highPass(e) {
    var check = document.getElementById('highPassCheck').checked;
    if (check == true) {
        highPassFilter = context.createBiquadFilter();
        sourceNode.connect(highPassFilter);
        highPassFilter.connect(context.destination);
        highPassFilter.type = 0;
        highPassFilter.frequency.value = 800;
    }
    else {
        highPassFilter.disconnect(0);
    }
};


/**
 * Low pass filter -- Not used in the application
 * @param e
 */
function lowPass(e) {
    var check = document.getElementById('lowPassCheck').checked;
    if (check == true) {
        lowPassFilter = context.createBiquadFilter();
        sourceNode.connect(lowPassFilter);
        lowPassFilter.connect(context.destination);
        lowPassFilter.type = 1;
        lowPassFilter.frequency.value = 1200;
    }
    else {
        lowPassFilter.disconnect(0);
    }
};


/**
 * Handeler for gain change event -- Not used in the application
 */
function gainChange() {
    if (gainFilter) {
        gainFilter.disconnect(0);
    }
    gainFilter = context.createBiquadFilter();
    gainFilter.type = 3;
    gainFilter.frequency.value = 440;
    gainFilter.gain.value = document.getElementById('gain').value;
    sourceNode.connect(gainFilter);
    gainFilter.connect(context.destination);
};


/**
 * Toggles audio mute and enables/disables volume control
 * and updates icons in the UI
 */
function toggleMute() {
    if (audio) {
        var currentVol = audio.volume;
        if (currentVol == 0) {
            audio.volume = storedVol;
            document.getElementById('volumeIcon').src = "Images/Volume.png";
            document.getElementById('vol').style.opacity = 1;
            document.getElementById('vol').removeAttribute('disabled');
        }
        else {
            storedVol = audio.volume;
            audio.volume = 0;
            document.getElementById('volumeIcon').src = "Images/mute.png";
            document.getElementById('vol').style.opacity = 0.4;
            document.getElementById('vol').setAttribute('disabled', 'disabled');
        }
    }
};

/**
 * Toggles audio repeat and updates icons in the UI
 */
function toggleRepeat() {
    if (repeat == true) {
        repeat = false;
        document.getElementById('repeatIcon').src = "Images/repeatOff.png";
    }
    else {
        repeat = true;
        document.getElementById('repeatIcon').src = "Images/repeat.png";
    }
};


/**
 * Method to update audio progress time in the progress bar
 */
function trackChange() {
    document.getElementById('progress').value = audio.currentTime;
    document.getElementById('progressTime').innerHTML = audio.currentTime.toString().getFormattedTime() + "/" + audio.duration.toString().getFormattedTime();
};
function progressChange() {
    //console.log("progressChange");
    clearInterval(progressTimer);
    audio.currentTime = document.getElementById('progress').value;
    progressTimer = setInterval("trackChange();", 100);
};


/**
 * Audio change handler - initiates spectrum and plays audio immediately
 * as the track is changed -- Not used
 * @param that
 */
function audioChange(that) {
    var files = that.files;

    if (files.length > 0) {
        var file = window.URL.createObjectURL(files[0]);
        if (document.getElementById('rectSVG')) {
            document.getElementById('rectSVG').parentNode.removeChild(document.getElementById('rectSVG'));
        }
        document.getElementById('trackNameValue').innerHTML = "::: Now Playing ::: " + files[0].name;
        loadSong(file);
        document.getElementsByClassName('focus')[0].classList.remove('focus');
    }
};


/**
 * Method to remove a selected track from the playlist
 */
function removeFromPlayList() {
    var selected = document.getElementsByClassName('songItemFocused');
    if (selected.length > 0) {
        var idx = selected[0].getAttribute('index');
        if (idx == indexPlaying) {
            return;
        }
        else {
            playList.splice(idx, 1);
            if (idx < indexPlaying)
                indexPlaying--;
            displayPlayList();
        }
    }
};


/**
 * Method to add a track from the playlist
 * @param that
 */
function addToPlaylist(that) {
    var files = that.files;
    for (var i = 0; i < files.length; i++) {
        var songExists = false;
        for (var j = 0; j < playList.length; j++) {
            if (playList[j].name == files[i].name) {
                songExists = true;
                break;
            }
        }
        if (songExists == false) {
            playList.push(files[i]);
        }
    }
//    console.log(playList);
    displayPlayList();
};


/**
 * Displays playlist's tracks in the UI playlist pane
 */
function displayPlayList() {
    var ring = document.getElementById('playlistRing');
    ring.innerHTML = "";
    for (var i = 0; i < playList.length; i++) {
        var songItem = document.createElement('div');
        var trackName = new String(playList[i].name);
        songItem.innerHTML = trackName.substring(0, trackName.indexOf("."));
        songItem.className = "songItem";
        songItem.style.top = i * 20 + 5 + "px";
        songItem.setAttribute('index', i);
        songItem.onclick = function () {
            if (document.getElementsByClassName('songItemFocused').length > 0)
                document.getElementsByClassName('songItemFocused')[0].classList.remove('songItemFocused');
            this.classList.add('songItemFocused');
        }
        ring.appendChild(songItem);
    }
    focusNowPlaying();
};


/**
 * Audio controls's next track event handler
 */
function next() {
    if (playList[indexPlaying + 1]) {
        //getArrayAndFillSVG(0);
        window.cancelAnimationFrame(requestAnimId);
        requestAnimId = undefined;
        playAudio();
        return;
    }
};


/**
 * Audio controls's previous track event handler
 */
function previous() {
    if (playList[indexPlaying - 1]) {
        //getArrayAndFillSVG(0);
        window.cancelAnimationFrame(requestAnimId);
        requestAnimId = undefined;
        indexPlaying = indexPlaying - 2;
        playAudio();
        return;
    }
};


/**
 * Handler for audio preset change
 * @param target
 */
function presetChanged(target) {
    if (audio) {
        document.getElementsByClassName('focusedBtn')[0].classList.remove('focusedBtn');
        target.classList.add('focusedBtn');
        if (target.id == "dance") {
            equalizer80Hz.gain.value = 8.12;
            equalizer240Hz.gain.value = 3.53;
            equalizer750Hz.gain.value = 0.35;
            equalizer2200Hz.gain.value = -0.35;
            equalizer6000Hz.gain.value = 2.18;
            document.getElementById('80').value = 8.12;
            document.getElementById('240').value = 3.53;
            document.getElementById('750').value = 0.35;
            document.getElementById('2200').value = -0.35;
            document.getElementById('6000').value = 2.18;
        }
        if (target.id == "powerful") {
            equalizer80Hz.gain.value = 10.97;
            equalizer240Hz.gain.value = 3.56;
            equalizer750Hz.gain.value = -0.5;
            equalizer2200Hz.gain.value = 3.39;
            equalizer6000Hz.gain.value = 10.97;
            document.getElementById('80').value = 10.97;
            document.getElementById('240').value = 3.56;
            document.getElementById('750').value = -0.5;
            document.getElementById('2200').value = 3.39;
            document.getElementById('6000').value = 10.97;
        }
        if (target.id == "live") {
            equalizer80Hz.gain.value = -18.00;
            equalizer240Hz.gain.value = -3.88;
            equalizer750Hz.gain.value = 6.68;
            equalizer2200Hz.gain.value = 4.44;
            equalizer6000Hz.gain.value = 5.97;
            document.getElementById('80').value = -18.00;
            document.getElementById('240').value = -3.88;
            document.getElementById('750').value = 6.68;
            document.getElementById('2200').value = 4.44;
            document.getElementById('6000').value = 5.97;
        }
        if (target.id == "soft") {
            equalizer80Hz.gain.value = -8.26;
            equalizer240Hz.gain.value = -7.56;
            equalizer750Hz.gain.value = -10.38;
            equalizer2200Hz.gain.value = 7.97;
            equalizer6000Hz.gain.value = 12.92;
            document.getElementById('80').value = -8.26;
            document.getElementById('240').value = -7.56;
            document.getElementById('750').value = -10.38;
            document.getElementById('2200').value = 7.97;
            document.getElementById('6000').value = 12.92;
        }
        if (target.id == "flat") {
            equalizer80Hz.gain.value = 0;
            equalizer240Hz.gain.value = 0;
            equalizer750Hz.gain.value = 0;
            equalizer2200Hz.gain.value = 0;
            equalizer6000Hz.gain.value = 0;
            document.getElementById('80').value = 0;
            document.getElementById('240').value = 0;
            document.getElementById('750').value = 0;
            document.getElementById('2200').value = 0;
            document.getElementById('6000').value = 0;
        }
    }
};


/**
 * Audio control's pause event handler
 */
function pauseAudio() {
    if (audio) {
        audio.pause();
        document.getElementsByClassName('focus')[0].classList.remove('focus');
        document.getElementById('pause').classList.add('focus');
        audio_paused_stopped = true;
    }
};


/**
 * Plays the audio updating the index
 */
function playAudio() {
    if (playList.length > 0) {
        if (audio_paused_stopped == true) {
            if (playList.length == 1)
                loadSong(window.URL.createObjectURL(playList[indexPlaying]));
            else
                audio.play();
            document.getElementsByClassName('focus')[0].classList.remove('focus');
            document.getElementById('play').classList.add('focus');
            audio_paused_stopped = false;
        }
        else {

            indexPlaying++;
            document.getElementsByClassName('focus')[0].classList.remove('focus');
            document.getElementById('play').classList.add('focus');
            loadSong(window.URL.createObjectURL(playList[indexPlaying]));
            focusNowPlaying();
        }
    }
};


/**
 * UI update for play event updating the track name in the ticker
 */
function focusNowPlaying() {
    if (document.getElementsByClassName('playingSong').length > 0)
        document.getElementsByClassName('playingSong')[0].classList.remove('playingSong');
    if (document.getElementsByClassName('songItem')[indexPlaying]) {
        document.getElementsByClassName('songItem')[indexPlaying].classList.add('playingSong');
        document.getElementById('trackNameValue').innerHTML = playList[indexPlaying].name;
    }
};


/**
 * Audio control's stop event handler
 */
function stopAudio() {
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        document.getElementsByClassName('focus')[0].classList.remove('focus');
        document.getElementById('stop').classList.add('focus');
        audio_paused_stopped = true;
    }
};


/**
 * Handler for manual equalizer change
 * @param target
 */
function eqValueChange(target) {
    if (target.id == 80) {
        console.log("80: " + target.value);
        equalizer80Hz.gain.value = target.value;
    }
    if (target.id == 240) {
        console.log("240: " + target.value);
        equalizer240Hz.gain.value = target.value;
    }
    if (target.id == 750) {
        console.log("750: " + target.value);
        equalizer750Hz.gain.value = target.value;
    }
    if (target.id == 2200) {
        console.log("2200: " + target.value);
        equalizer2200Hz.gain.value = target.value;
    }
    if (target.id == 6000) {
        console.log("6000: " + target.value);
        equalizer6000Hz.gain.value = target.value;
    }

};



/**
 * String's time display helper
 */
String.prototype.getFormattedTime = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var hrs = Math.floor(sec_num / 3600);
    var mins = Math.floor((sec_num - (hrs * 3600)) / 60);
    var sec = sec_num - (hrs * 3600) - (mins * 60);
    if (hrs < 10) {
        hrs = "0" + hrs;
    }
    if (mins < 10) {
        mins = "0" + mins;
    }
    if (sec < 10) {
        sec = "0" + sec;
    }
    var time = mins + ':' + sec;
    return time;
};