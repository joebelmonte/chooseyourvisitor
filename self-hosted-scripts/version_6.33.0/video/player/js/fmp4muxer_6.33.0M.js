class FMP4Muxer {
    constructor(){
      this.sequence_number = 1;
      this.sequence_duration = 0;
      this.width = 0;
      this.height = 0;
      this.frame_rate = 15;
      this.timescale = 1000;
      this.frame_count = 0;
      this.sps = undefined;
      this.pps = undefined;
  
      const majorBrand = new Uint8Array([109, 112, 52, 50]); // mp42
      const minorBrand = new Uint8Array([105, 115, 111, 109]); // isom
      const avc1Brand = new Uint8Array([97, 118, 99, 49]); // avc1
      const minorVersion = new Uint8Array([0, 0, 0, 1]); 
  
      this.FTYP = this.box(
          "ftyp",
          majorBrand,
          minorVersion,
          minorBrand,
          majorBrand,
          avc1Brand
      );
    }

    reset(){
      this.frame_count = 0;
      this.sequence_number = 1;
      this.sequence_duration = 0;
    }
  
    mux(payload){
      let nalus = this.parseNALUs(payload);
      var totalSize = 0;
      var containsSps = false;
      var containsPps = false;
      var containsKeyframe = false;
      var spsPpsChanged = false;
      
      for (var i = 0; i < nalus.length; i++) {
          let nalu = nalus[i];
          let naluBuffer = payload.slice(nalu.payload_start_offset, nalu.payload_start_offset + nalu.payload_size);
          if (nalu.type==7){
              if (this.sps){
                if (naluBuffer.length == this.sps.length){
                  for (var j = 0; j < this.sps.length; j++){
                    if (this.sps[j] != naluBuffer[j]){
                      spsPpsChanged = true;
                    }
                  }
                }else {
                  spsPpsChanged = true;
                }
              }
              this.sps = naluBuffer;
              containsSps = true;
          }else if (nalu.type == 8){
              if (this.pps){
                if (naluBuffer.length == this.pps.length){
                  for (var j = 0; j < this.pps.length; j++){
                    if (this.pps[j] != naluBuffer[j]){
                      spsPpsChanged = true;
                    }
                  }
                }else {
                  spsPpsChanged = true;
                }
              }
              this.pps = naluBuffer;
              containsPps = true;
          } else if (nalu.type == 5){
              containsKeyframe = true;
          }
  
          if (nalu.type == 5 || nalu.type == 1){
            totalSize = totalSize + nalu.payload_size;
          }
      }

      if ((this.frame_count == 0) && !containsKeyframe){
          return undefined;
      }
  
      if (totalSize > 0 && this.sps && this.pps){
        const moof = this.moof(this.sequence_number, this.sequence_duration, nalus);
        const mdat = this.mdat(payload, nalus)
  
        var muxerResult = {moof: moof, mdat: mdat, sps: containsSps, pps: containsPps, keyframe: containsKeyframe, spsPpsChanged: spsPpsChanged}

        if (containsKeyframe){
          muxerResult.ftyp = this.FTYP;
          muxerResult.moov = this.moov(this.timescale, 0, this.width, this.height, this.frame_rate);
        }

        if (spsPpsChanged){
          this.frame_count = 0;
        }

        this.sequence_duration = this.sequence_duration + 1000;
        this.frame_count++;
  
        return muxerResult;
      }
  
      return undefined
    }
  
    moov(timescale, duration, width, height, frame_rate){
      if (!this.mvhd){
        this.mvhd = this.box("mvhd", new Uint8Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,232,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255]));
      }
      if (!this.mdhd){
        this.mdhd = this.box("mdhd", new Uint8Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,117,48,0,0,0,0,85,196,0,0]));
      }
      if (!this.hdlr){
        this.hdlr = this.box("hdlr", new Uint8Array([0,0,0,0,0,0,0,0,118,105,100,101,0,0,0,0,0,0,0,0,0,0,0,0,66,101,110,116,111,52,32,86,105,100,101,111,32,72,97,110,100,108,101,114,0]));
      }
      if (!this.stts){
        this.stts = this.box("stts", new Uint8Array([0,0,0,0,0,0,0,0]))
      }
      if (!this.stsc){
        this.stsc = this.box("stsc", new Uint8Array([0,0,0,0,0,0,0,0]))
      }
      if (!this.stsz){
        this.stsz = this.box("stsz", new Uint8Array([0,0,0,0,0,0,0,0,0,0,0,0]));
      }
      if (!this.stco){
        this.stco = this.box("stco", new Uint8Array([0,0,0,0,0,0,0,0]));
      }
      if (!this.vmhd){
        this.vmhd = this.box("vmhd", new Uint8Array([0,0,0,1,0,0,0,0,0,0,0,0]));
      }
      if (!this.dinf){
        this.dinf = this.box("dinf", new Uint8Array([0,0,0,28,100,114,101,102,0,0,0,0,0,0,0,1,0,0,0,12,117,114,108,32,0,0,0,1]));
      }
      if (!this.mvex){
        this.mvex = this.box("mvex", new Uint8Array([0,0,0,16,109,101,104,100,0,0,0,0,0,0,0,0,0,0,0,32,116,114,101,120,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0]))
      }
  
      let tkhdData = new Uint8Array([0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,(width >> 8) & 0xff,width & 0xff,0,0,(height >> 8) & 0xff,height & 0xff,0,0])
      let tkhd = this.box("tkhd", tkhdData)
  
      const spsLen = this.sps.byteLength;
      const spsData = new Uint8Array(2+spsLen);
      spsData.set([(spsLen >>> 8) & 0xff,spsLen & 0xff], 0)
      spsData.set(this.sps, 2)
      const ppsLen = this.pps.byteLength;
      const ppsData = new Uint8Array(3+ppsLen);
      ppsData.set([1], 0)
      ppsData.set([(ppsLen >>> 8) & 0xff, ppsLen & 0xff], 1)
      ppsData.set(this.pps, 3)
  
      let avcC = this.box("avcC", 
        new Uint8Array([1,this.sps[1],this.sps[2],this.sps[3],255,225]), 
        spsData,
        ppsData)
      let avc1 = this.box("avc1", 
        new Uint8Array([0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,(width >> 8) & 0xff,width & 0xff,(height >> 8) & 0xff,height & 0xff,0,72,0,0,0,72,0,0,0,0,0,0,0,1,4,104,50,54,52,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,24,255,255]),
        avcC   
      );
      let stsd = this.box("stsd", new Uint8Array([0,0,0,0,0,0,0,1]), avc1);
      let stbl = this.box("stbl", stsd, this.stts, this.stsc, this.stsz, this.stco);
      let minf = this.box("minf", this.vmhd, this.dinf, stbl);
  
      let mdia = this.box("mdia", this.mdhd, this.hdlr, minf)
      let trak = this.box("trak", tkhd, mdia);
  
      return this.box(
          "moov",
          this.mvhd,
          trak,
          this.mvex);
    }
  
    moof(sequenceNumber, baseMediaDecodeTime, nalus){
      const UINT32_MAX = Math.pow(2, 32) - 1;
  
      var mdatSize = 0;
      for (var i = 0; i < nalus.length; i++) {
          let nalu = nalus[i];
          mdatSize += 4 + nalu.payload_size;
      }
  
      let mfhd = this.box(
          "mfhd",
          new Uint8Array([
            0x00,
            0x00,
            0x00,
            0x00, // flags
            sequenceNumber >> 24,
            (sequenceNumber >> 16) & 0xff,
            (sequenceNumber >> 8) & 0xff,
            sequenceNumber & 0xff, // sequence_number
          ])
        );
  
      const upperWordBaseMediaDecodeTime = Math.floor(
          baseMediaDecodeTime / (UINT32_MAX + 1)
        );
        const lowerWordBaseMediaDecodeTime = Math.floor(
          baseMediaDecodeTime % (UINT32_MAX + 1)
        );
  
      let traf = this.box(
          "traf",
          new Uint8Array([
              0,0,0,20,116,102,104,100,0,2,0,32,0,0,0,2,1,1,0,0,0,0,0,20,116,102,100,116,1,0,0,0,
              upperWordBaseMediaDecodeTime >> 24,
              (upperWordBaseMediaDecodeTime >> 16) & 0xff,
              (upperWordBaseMediaDecodeTime >> 8) & 0xff,
              upperWordBaseMediaDecodeTime & 0xff,
              lowerWordBaseMediaDecodeTime >> 24,
              (lowerWordBaseMediaDecodeTime >> 16) & 0xff,
              (lowerWordBaseMediaDecodeTime >> 8) & 0xff,
              lowerWordBaseMediaDecodeTime & 0xff
              ,0,0,0,32,116,114,117,110,0,0,3,5,0,0,0,1,0,0,0,112,2,0,0,0,0,0,3,232,
              mdatSize >> 24,
            (mdatSize >> 16) & 0xff,
            (mdatSize >> 8) & 0xff,
            mdatSize & 0xff])
      );
  
      return this.box(
          "moof",
          mfhd,
          traf);
    }
  
    mdat(payload, nalus){
      var totalSize = 0;
  
      for (var i = 0; i < nalus.length; i++) {
          let nalu = nalus[i];
          
          totalSize += 4 + nalu.payload_size;
      }
  
      var mdatData = new Uint8Array(totalSize);
      var mdatIndex = 0;
  
      if (totalSize > 0){
        for (var i = 0; i < nalus.length; i++) {
            let nalu = nalus[i];
            let naluBuffer = payload.slice(nalu.payload_start_offset, nalu.payload_start_offset + nalu.payload_size);
            
            let payloadSize = nalu.payload_size;
            mdatData.set([payloadSize >> 24,
                  (payloadSize >> 16) & 0xff,
                  (payloadSize >> 8) & 0xff,
                  payloadSize & 0xff], mdatIndex);
            mdatIndex += 4;
            mdatData.set(naluBuffer, mdatIndex);
            mdatIndex += nalu.payload_size;
        }
      }
  
      return this.box(
          "mdat",
          mdatData);
    }
  
    box(typeString, ...payload) {
      let type = [
        typeString.charCodeAt(0),
        typeString.charCodeAt(1),
        typeString.charCodeAt(2),
        typeString.charCodeAt(3),
      ];
      let size = 8;
      let i = payload.length;
      const len = i;
      // calculate the total size we need to allocate
      while (i--) {
        size += payload[i].byteLength;
      }
  
      const result = new Uint8Array(size);
      result[0] = (size >> 24) & 0xff;
      result[1] = (size >> 16) & 0xff;
      result[2] = (size >> 8) & 0xff;
      result[3] = size & 0xff;
      result.set(type, 4);
      // copy the payload into the result
      for (i = 0, size = 8; i < len; i++) {
        // copy payload[i] array @ offset size
        result.set(payload[i], size);
        size += payload[i].byteLength;
      }
      return result;
    }
  
    parseNALUs(buffer){
      const kNaluLongStartSequenceSize = 4;
      // The size of a shortened NALU start sequence {0 0 1}, that may be used if
      // not the first NALU of an access unit or an SPS or PPS block.
      const kNaluShortStartSequenceSize = 3;
      // The size of the NALU type byte (1).
      const kNaluTypeSize = 1;
  
      var nalus = [];
  
      const buffer_size = buffer.byteLength;
  
      if (buffer_size < kNaluShortStartSequenceSize){
          return nalus;
      }
  
      const buffer_end = buffer_size - kNaluShortStartSequenceSize;
      for (var i = 0; i < buffer_end;) {
        if (buffer[i + 2] > 1) {
          i += 3;
        } else if (buffer[i + 2] == 1) {
          if (buffer[i + 1] == 0 && buffer[i] == 0) {
            // We found a start sequence, now check if it was a 3 of 4 byte one.
            var index = {start_offset: i, payload_start_offset: i + 3, payload_size: 0};
            if (index.start_offset > 0 && buffer[index.start_offset - 1] == 0){
              --index.start_offset;
            }
  
            index.type = buffer[index.payload_start_offset] & 0x1F;
  
            // Update length of previous entry.
            if (nalus.length > 0){
              var lastNalu = nalus[nalus.length - 1];
              lastNalu.payload_size = index.start_offset - lastNalu.payload_start_offset;
            }
  
            nalus.push(index);
          }
  
          i += 3;
        } else {
          ++i;
        }
      }
  
      if (nalus.length > 0){
        var lastNalu = nalus[nalus.length - 1];
        lastNalu.payload_size = buffer_size - lastNalu.payload_start_offset;
      }

      if (nalus.length==0){
        var index = {start_offset: 0, payload_start_offset: 0, payload_size: buffer_size};
        index.type = buffer[index.payload_start_offset] & 0x1F;
        if ((index.type==1)
          || (index.type == 5)
          || (index.type == 7)
          || (index.type == 8)){
            nalus.push(index);
          }
      }
  
      return nalus;
    }
  }
