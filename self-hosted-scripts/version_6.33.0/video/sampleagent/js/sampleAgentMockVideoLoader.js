function laodScript(url) {
  return new Promise( function( resolve, reject ) {
      let script = document.createElement( "script" );
      script.src = url;
      script.type = 'text/javascript'
      script.onload = resolve;
      script.onerror = () => reject( new Error( `Error when loading ${url}!` ) );
      document.body.appendChild( script );
  } );
}

window.onload = function() {
  const urlParams = new URLSearchParams(window.location.search);
  let envURL = urlParams.get("environment");
  let version = urlParams.get("version");
  let gvssrc = envURL + "/video/source/js/GlanceVideoSource" + "_" + version + ".js"
  let bcsrc = envURL + "/video/source/js/browserCap" + "_" + version + ".js"
  laodScript(bcsrc)
  .then( () => laodScript(gvssrc))
  .then( () => laodScript(envURL + "/video/sampleagent/js/sampleAgentMockVideo.js"));
}