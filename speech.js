const speechController = (() => {
  let voices = [];

  function getVoices() {
    voices = window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
    return voices;
  }

  function waitForVoices(callback) {
    const list = getVoices();
    if (list.length) {
      callback(list);
      return;
    }
    if (!window.speechSynthesis) {
      callback([]);
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => callback(getVoices());
  }

  function voicesFor(langPrefix) {
    return getVoices().filter((voice) => voice.lang && voice.lang.toLowerCase().startsWith(langPrefix));
  }

  function selectVoice(voiceName, langPrefix) {
    const allVoices = getVoices();
    return allVoices.find((voice) => voice.name === voiceName)
      || voicesFor(langPrefix)[0]
      || allVoices[0]
      || null;
  }

  function stop() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function speak({ text, langPrefix, rate, voiceName }) {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('Speech synthesis is not supported.'));
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      const selected = selectVoice(voiceName, langPrefix);
      if (selected) {
        utterance.voice = selected;
        utterance.lang = selected.lang;
      } else {
        utterance.lang = langPrefix === 'ja' ? 'ja-JP' : 'en-US';
      }
      utterance.rate = Number(rate) || 1;
      utterance.pitch = 1;
      utterance.onend = () => resolve(selected);
      utterance.onerror = (event) => reject(event.error || event);
      window.speechSynthesis.speak(utterance);
    });
  }

  return { getVoices, waitForVoices, voicesFor, speak, stop };
})();
