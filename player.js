{
  // DOM
  const script = document.currentScript;
  let canvas = document.getElementById('canvas');
  if (!canvas) {
    canvas = document.createElement('CANVAS');
    canvas.id = 'canvas';
    script.parentNode.insertBefore(canvas, script);
  }
  canvas.oncontextmenu = () => event.preventDefault();
  let spinner = document.getElementById('spinner');
  if (!spinner) {
    spinner = document.createElement('DIV');
    spinner.id = 'spinner';
    script.parentNode.after(spinner, script);
  }
  spinner.className = 'pending';
  
  // Parse arguments from the URL address
  let url = new URL(script.src);
  if (!url.searchParams.has('g'))
    url = new URL(window.location.href);
  let arg = url.searchParams.get('arg');
  let uri = url.searchParams.get('g');
  if (uri == null)
    uri = 'nogame.love';
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

  import('./game.js')
    .then((imported) => {
      const load = imported.default;

      // Runs the requested package
      window.runLove = () => {
        //state = 'loading';
        spinner.className = 'loading';
        load(canvas, uri, arg)
          .then((res) => {
            canvas.focus();
            //state = 'playing';
            spinner.className = '';
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
        if (spinner.className != 'error') {
        //if (state != 'failed') {
          canvas.style.display = 'none';
          //state = 'failed';
          spinner.className = 'error';
        }
      };

      // Focus when running inside an iFrame
      window.onload = window.focus.bind(window);
      
      // Handle touch and mouse input
      window.onclick = (e) => {
        window.focus();
        //if (state == 'pending')
        if (spinner.className == 'pending')
          window.consentDialog();
      };

      // Disable window scrolling using the arrow keys
      const prevent = [37, 38, 39, 40, 13];
      window.onkeydown = (e) => {
        if (prevent.indexOf(e.keyCode) > -1)
          e.preventDefault();
        //if (e.keyCode != 27 && state == 'pending')
        if (e.keyCode != 27 && spinner.className == 'pending')
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
          d.setTime(d.getTime() + (1000*60*60*24*365*10));
          const stamp = d.toUTCString();
          document.cookie = `lovejs=true;expires=${stamp};path=/`;
        }
        
        window.runLove();
      }
      
      window.consentDialog();
    });
};