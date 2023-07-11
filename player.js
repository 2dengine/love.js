{
  // DOM
  const canvas = document.getElementById('canvas');
  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('modal');

  // Error handling
  let state = 'pending';

  // Parse arguments from the URL address
  const url = new URL(window.location.href);
  const params = url.searchParams;
  let arg = params.get('arg');
  if (arg) {
    try {
      arg = JSON.parse(arg);
      if (!Array.isArray(arg))
        arg = [arg];
    } catch(error) {
      arg = null;
      console.log(error);
    }
  }
  let uri = params.get('g');
  if (uri == null)
    uri = 'nogame.love';
  const imported = await import('./game.js');
  const load = imported.default;

  // Runs the requested package
  window.runLove = () => {
    state = 'loading';
    modal.classList.add('loading');
    load(canvas, uri, arg)
      .then((res) => {
        canvas.focus();
        overlay.style.display = 'none';
        state = 'playing';
      })
      .catch((err) => {
        console.log(err);
        if (uri != 'nogame.love') {
          uri = 'nogame.love';
          arg = null;
          window.runLove();
        }
      });
  }
  
  // Handling errors
  window.alert = window.onerror = (msg) => {
    console.log(msg);
    if (state != 'failed') {
      canvas.style.display = 'none';
      modal.classList.add('error');
      overlay.style.display = 'block';
      state = 'failed';
    }
  };

  // Focus when running inside an iFrame
  window.onload = window.focus.bind(window);
  
  // Handle touch and mouse input
  window.onclick = (e) => {
    window.focus();
    if (state == 'pending')
      window.consentDialog();
  };

  // Disable window scrolling using the arrow keys
  const prevent = [37, 38, 39, 40, 13];
  window.onkeydown = (e) => {
    if (prevent.indexOf(e.keyCode) > -1)
      e.preventDefault();
    if (e.keyCode != 27 && state == 'pending')
      window.consentDialog();
  }

  // GDPR consent dialog
  window.consentDialog = () => {
    let value = null;
    const decode = decodeURIComponent(document.cookie);
    const ca = decode.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ')
        c = c.substring(1);
      if (c.indexOf('lovejs=') == 0)
        value = c.substring(('lovejs=').length, c.length);
    }
    if (value != 'true') {
      if (!confirm('Allow access to local data storage?'))
        return;
      const d = new Date();
      d.setTime(d.getTime() + (60*60*24*365*10*1000));
      const stamp = d.toUTCString();
      document.cookie = `lovejs=true;expires=${stamp};path=/`;
    }
    
    window.runLove();
  }
  
  window.consentDialog();
};