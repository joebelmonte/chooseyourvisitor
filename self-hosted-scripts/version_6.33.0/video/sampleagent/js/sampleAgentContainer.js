document.getElementById("environment").onchange = () => {
  if(document.getElementById("environment").value == "none") {
    document.getElementById("local_environment_container").style.display = "table-cell"
  } else {
    document.getElementById("local_environment_container").style.display = "none"
  }
}

document.getElementById("load").onclick = () => {
  let sampleAgentUrl = `${document.location.origin}/videotestpages/sampleAgentMockVideo.aspx?`
  let res = document.getElementById("resolution").value
  if(!res) {
      res = "640x360";
  }

  let framerate = document.getElementById("framerate").value
  if(!framerate || framerate.length == 0 || isNaN(framerate)) {
    framerate = "24";
  }

  let bandwidth = document.getElementById("bandwidth").value
  if(!bandwidth || bandwidth.length == 0) {
    bandwidth = "1500kbps";
  }

  sampleAgentUrl = sampleAgentUrl + "framerate=" + framerate + "&res=" + res + "&bandwidth=" + bandwidth;
  if(document.getElementById("disable_blur").checked) {
    sampleAgentUrl = sampleAgentUrl + "&blur=false"
  }

  let version = document.getElementById("version").value
  let env = document.getElementById("environment").value
  if(!env || env == "none") {
    // The case of local testing
    env = document.getElementById("local_environment").value;
  }
  let envurl = "https://" + env;
  sampleAgentUrl = sampleAgentUrl + "&environment=" + envurl + "&version=" + version;

  let mockVideo = document.getElementById("videomockurl").value
  if(mockVideo && mockVideo.trim().length > 0) {
      sampleAgentUrl = sampleAgentUrl + "&videomockurl=" + mockVideo;
  }

  let storage = document.getElementById("storageurl").value
  if(storage && storage.trim().length > 0) {
      sampleAgentUrl = sampleAgentUrl + "&videostorageurl=" + storage;
  }

  let model = document.getElementById("model").value
  if(model == "new_slefie_segmentation") {
      sampleAgentUrl = sampleAgentUrl + "&segmentationModel=slefie_segmentation";
  } else if(model == "blazepose") {
      sampleAgentUrl = sampleAgentUrl + "&segmentationModel=blazepose";
  }

  let loadbalancer = document.getElementById("is-lb").checked
  if(loadbalancer) {
    sampleAgentUrl = sampleAgentUrl + "&loadbalancer=" + loadbalancer;
  }

  let iframe = document.getElementById("sample_agent");
  if(iframe == null) {
      iframe = document.createElement("iframe");
      iframe.id = "sample_agent";
      iframe.style.width = "80%";
      iframe.style.height = "800px";
      document.body.appendChild(iframe);
  }

  iframe.src = sampleAgentUrl;
}