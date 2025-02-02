/*globals ebml */

if ( !window.ebml ) window.ebml = {};

ebml.EbmlDecoder = function EbmlDecoder( options ) {

  // noinspection JSUnusedAssignment
  /*********** constructor ***************/
  options = options || {};

  //var debug = console.log;
  var debug = function () {
  };

  var STATE_TAG = 1,
    STATE_SIZE = 2,
    STATE_CONTENT = 3;

  var self = this;

  self._buffer = null;
  self._tag_stack = [];
  self._state = STATE_TAG;
  self._cursor = 0;
  self._total = 0;
  self._writecount = 0;

  EbmlDecoder.prototype.reset = function () {

    self._buffer = null;
    self._tag_stack = [];
    self._state = STATE_TAG;
    self._cursor = 0;
    self._total = 0;
    self._writecount = 0;

  };


  EbmlDecoder.prototype.write = function ( chunk, callback ) {

    self._callback = callback;

    self._writecount++;
    if ( self._buffer === null ) {
      self._buffer = new Uint8Array( chunk );
    }
    else {
      self._buffer = tools.concatenate( self._buffer, new Uint8Array( chunk ) );
    }

    while ( self._cursor < self._buffer.length ) {
      if ( self._state === STATE_TAG && !self.readTag() ) {
        break;
      }
      if ( self._state === STATE_SIZE && !self.readSize() ) {
        break;
      }
      if ( self._state === STATE_CONTENT && !self.readContent() ) {
        break;
      }
    }
  };

  EbmlDecoder.prototype.getSchemaInfo = function ( tagStr ) {
    return self._schema[ tagStr ] || {
      'type': 'unknown',
      'name': 'unknown'
    };
  };

  EbmlDecoder.prototype.readTag = function () {

    debug( 'parsing tag' );

    if ( self._cursor >= self._buffer.length ) {
      debug( 'waiting for more data' );
      return false;
    }

    const start = self._total;
    const tag = tools.readVint( self._buffer, self._cursor );

    if ( tag == null ) {
      debug( 'waiting for more data' );
      return false;
    }

    var tagStr = tools.readHexString( self._buffer, self._cursor, self._cursor + tag.length );
    self._cursor += tag.length;
    self._total += tag.length;
    self._state = STATE_SIZE;

    var tagObj = {
      tag: tag.value,
      tagStr: tagStr,
      type: self.getSchemaInfo( tagStr ).type,
      name: self.getSchemaInfo( tagStr ).name,
      start: start,
      end: start + tag.length
    };

    self._tag_stack.push( tagObj );
    debug( 'read tag: ' + tagStr );

    return true;
  };

  EbmlDecoder.prototype.readSize = function () {

    const tagObj = self._tag_stack[ self._tag_stack.length - 1 ];

    debug( 'parsing size for tag: ' + tagObj.tag.toString( 16 ) );

    if ( self._cursor >= self._buffer.length ) {
      debug( 'waiting for more data' );
      return false;
    }

    var size = tools.readVint( self._buffer, self._cursor );

    if ( !size ) {
      debug( 'waiting for more data' );
      return false;
    }

    self._cursor += size.length;
    self._total += size.length;
    self._state = STATE_CONTENT;
    tagObj.dataSize = size.value;

    // unknown size
    if ( size.value === -1 ) {
      tagObj.end = -1;
    }
    else {
      tagObj.end += size.value + size.length;
    }

    debug( 'read size: ' + size.value );

    return true;
  };

  EbmlDecoder.prototype.readContent = function () {

    var tagObj = self._tag_stack[ self._tag_stack.length - 1 ];

    debug( 'parsing content for tag: ' + tagObj.tag.toString( 16 ) );

    if ( tagObj.type === 'm' ) {
      debug( 'content should be tags' );
      self._callback( [ 'start', tagObj ] );
      self._state = STATE_TAG;
      return true;
    }

    if ( self._buffer.length < self._cursor + tagObj.dataSize ) {
      debug( 'got: ' + self._buffer.length );
      debug( 'need: ' + ( self._cursor + tagObj.dataSize ) );
      debug( 'waiting for more data' );
      return false;
    }

    var data = self._buffer.subarray( self._cursor, self._cursor + tagObj.dataSize );
    self._total += tagObj.dataSize;
    self._state = STATE_TAG;
    self._buffer = self._buffer.subarray( self._cursor + tagObj.dataSize );
    self._cursor = 0;

    self._tag_stack.pop(); // remove the object from the stack
    self._callback( [ 'tag', tools.readDataFromTag( tagObj, data ) ] );

    while ( self._tag_stack.length > 0 ) {
      var topEle = self._tag_stack[ self._tag_stack.length - 1 ];
      if ( self._total < topEle.end ) {
        break;
      }
      self._callback( [ 'end', topEle ] );
      self._tag_stack.pop();
    }

    debug( 'read data: ' + tools.readHexString( data ) );
    return true;

  };
  EbmlDecoder.prototype.schema = {
    "80": {
      "name": "ChapterDisplay",
      "level": "4",
      "type": "m",
      "multiple": "1",
      "minver": "1",
      "webm": "1"
    },
    "83": {
      "name": "TrackType",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "range": "1-254"
    },
    "85": {
      "name": "ChapString",
      "cppname": "ChapterString",
      "level": "5",
      "type": "8",
      "mandatory": "1",
      "minver": "1",
      "webm": "1"
    },
    "86": {
      "name": "CodecID",
      "level": "3",
      "type": "s",
      "mandatory": "1",
      "minver": "1"
    },
    "88": {
      "name": "FlagDefault",
      "cppname": "TrackFlagDefault",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "default": "1",
      "range": "0-1"
    },
    "89": {
      "name": "ChapterTrackNumber",
      "level": "5",
      "type": "u",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1",
      "webm": "0",
      "range": "not 0"
    },
    "91": {
      "name": "ChapterTimeStart",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "1"
    },
    "92": {
      "name": "ChapterTimeEnd",
      "level": "4",
      "type": "u",
      "minver": "1",
      "webm": "0"
    },
    "96": {
      "name": "CueRefTime",
      "level": "5",
      "type": "u",
      "mandatory": "1",
      "minver": "2",
      "webm": "0"
    },
    "97": {
      "name": "CueRefCluster",
      "level": "5",
      "type": "u",
      "mandatory": "1",
      "webm": "0"
    },
    "98": {
      "name": "ChapterFlagHidden",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "0",
      "range": "0-1"
    },
    "4254": {
      "name": "ContentCompAlgo",
      "level": "6",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "0",
      "br": [
        "",
        "",
        "",
        ""
      ],
      "del": [
        "1 - bzlib,",
        "2 - lzo1x"
      ]
    },
    "4255": {
      "name": "ContentCompSettings",
      "level": "6",
      "type": "b",
      "minver": "1",
      "webm": "0"
    },
    "4282": {
      "name": "DocType",
      "level": "1",
      "type": "s",
      "mandatory": "1",
      "default": "matroska",
      "minver": "1"
    },
    "4285": {
      "name": "DocTypeReadVersion",
      "level": "1",
      "type": "u",
      "mandatory": "1",
      "default": "1",
      "minver": "1"
    },
    "4286": {
      "name": "EBMLVersion",
      "level": "1",
      "type": "u",
      "mandatory": "1",
      "default": "1",
      "minver": "1"
    },
    "4287": {
      "name": "DocTypeVersion",
      "level": "1",
      "type": "u",
      "mandatory": "1",
      "default": "1",
      "minver": "1"
    },
    "4444": {
      "name": "SegmentFamily",
      "level": "2",
      "type": "b",
      "multiple": "1",
      "minver": "1",
      "webm": "0",
      "bytesize": "16"
    },
    "4461": {
      "name": "DateUTC",
      "level": "2",
      "type": "d",
      "minver": "1"
    },
    "4484": {
      "name": "TagDefault",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "1",
      "range": "0-1"
    },
    "4485": {
      "name": "TagBinary",
      "level": "4",
      "type": "b",
      "minver": "1",
      "webm": "0"
    },
    "4487": {
      "name": "TagString",
      "level": "4",
      "type": "8",
      "minver": "1",
      "webm": "0"
    },
    "4489": {
      "name": "Duration",
      "level": "2",
      "type": "f",
      "minver": "1",
      "range": "> 0"
    },
    "4598": {
      "name": "ChapterFlagEnabled",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "1",
      "range": "0-1"
    },
    "4660": {
      "name": "FileMimeType",
      "level": "3",
      "type": "s",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "4661": {
      "name": "FileUsedStartTime",
      "level": "3",
      "type": "u",
      "divx": "1"
    },
    "4662": {
      "name": "FileUsedEndTime",
      "level": "3",
      "type": "u",
      "divx": "1"
    },
    "4675": {
      "name": "FileReferral",
      "level": "3",
      "type": "b",
      "webm": "0"
    },
    "5031": {
      "name": "ContentEncodingOrder",
      "level": "5",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "0"
    },
    "5032": {
      "name": "ContentEncodingScope",
      "level": "5",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "1",
      "range": "not 0",
      "br": [
        "",
        "",
        ""
      ]
    },
    "5033": {
      "name": "ContentEncodingType",
      "level": "5",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "0",
      "br": [
        "",
        ""
      ]
    },
    "5034": {
      "name": "ContentCompression",
      "level": "5",
      "type": "m",
      "minver": "1",
      "webm": "0"
    },
    "5035": {
      "name": "ContentEncryption",
      "level": "5",
      "type": "m",
      "minver": "1",
      "webm": "0"
    },
    "5378": {
      "name": "CueBlockNumber",
      "level": "4",
      "type": "u",
      "minver": "1",
      "default": "1",
      "range": "not 0"
    },
    "5654": {
      "name": "ChapterStringUID",
      "level": "4",
      "type": "8",
      "mandatory": "0",
      "minver": "3",
      "webm": "1"
    },
    "5741": {
      "name": "WritingApp",
      "level": "2",
      "type": "8",
      "mandatory": "1",
      "minver": "1"
    },
    "5854": {
      "name": "SilentTracks",
      "cppname": "ClusterSilentTracks",
      "level": "2",
      "type": "m",
      "minver": "1",
      "webm": "0"
    },
    "6240": {
      "name": "ContentEncoding",
      "level": "4",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "6264": {
      "name": "BitDepth",
      "cppname": "AudioBitDepth",
      "level": "4",
      "type": "u",
      "minver": "1",
      "range": "not 0"
    },
    "6532": {
      "name": "SignedElement",
      "level": "3",
      "type": "b",
      "multiple": "1",
      "webm": "0"
    },
    "6624": {
      "name": "TrackTranslate",
      "level": "3",
      "type": "m",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "6911": {
      "name": "ChapProcessCommand",
      "cppname": "ChapterProcessCommand",
      "level": "5",
      "type": "m",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "6922": {
      "name": "ChapProcessTime",
      "cppname": "ChapterProcessTime",
      "level": "6",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "6924": {
      "name": "ChapterTranslate",
      "level": "2",
      "type": "m",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "6933": {
      "name": "ChapProcessData",
      "cppname": "ChapterProcessData",
      "level": "6",
      "type": "b",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "6944": {
      "name": "ChapProcess",
      "cppname": "ChapterProcess",
      "level": "4",
      "type": "m",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "6955": {
      "name": "ChapProcessCodecID",
      "cppname": "ChapterProcessCodecID",
      "level": "5",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "0"
    },
    "7373": {
      "name": "Tag",
      "level": "2",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "7384": {
      "name": "SegmentFilename",
      "level": "2",
      "type": "8",
      "minver": "1",
      "webm": "0"
    },
    "7446": {
      "name": "AttachmentLink",
      "cppname": "TrackAttachmentLink",
      "level": "3",
      "type": "u",
      "minver": "1",
      "webm": "0",
      "range": "not 0"
    },
    "258688": {
      "name": "CodecName",
      "level": "3",
      "type": "8",
      "minver": "1"
    },
    "18538067": {
      "name": "Segment",
      "level": "0",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1"
    },
    "447a": {
      "name": "TagLanguage",
      "level": "4",
      "type": "s",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "und"
    },
    "45a3": {
      "name": "TagName",
      "level": "4",
      "type": "8",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "67c8": {
      "name": "SimpleTag",
      "cppname": "TagSimple",
      "level": "3",
      "recursive": "1",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "63c6": {
      "name": "TagAttachmentUID",
      "level": "4",
      "type": "u",
      "multiple": "1",
      "minver": "1",
      "webm": "0",
      "default": "0"
    },
    "63c4": {
      "name": "TagChapterUID",
      "level": "4",
      "type": "u",
      "multiple": "1",
      "minver": "1",
      "webm": "0",
      "default": "0"
    },
    "63c9": {
      "name": "TagEditionUID",
      "level": "4",
      "type": "u",
      "multiple": "1",
      "minver": "1",
      "webm": "0",
      "default": "0"
    },
    "63c5": {
      "name": "TagTrackUID",
      "level": "4",
      "type": "u",
      "multiple": "1",
      "minver": "1",
      "webm": "0",
      "default": "0"
    },
    "63ca": {
      "name": "TargetType",
      "cppname": "TagTargetType",
      "level": "4",
      "type": "s",
      "minver": "1",
      "webm": "0",
      "strong": "informational"
    },
    "68ca": {
      "name": "TargetTypeValue",
      "cppname": "TagTargetTypeValue",
      "level": "4",
      "type": "u",
      "minver": "1",
      "webm": "0",
      "default": "50"
    },
    "63c0": {
      "name": "Targets",
      "cppname": "TagTargets",
      "level": "3",
      "type": "m",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "1254c367": {
      "name": "Tags",
      "level": "1",
      "type": "m",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "450d": {
      "name": "ChapProcessPrivate",
      "cppname": "ChapterProcessPrivate",
      "level": "5",
      "type": "b",
      "minver": "1",
      "webm": "0"
    },
    "437e": {
      "name": "ChapCountry",
      "cppname": "ChapterCountry",
      "level": "5",
      "type": "s",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "437c": {
      "name": "ChapLanguage",
      "cppname": "ChapterLanguage",
      "level": "5",
      "type": "s",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1",
      "webm": "1",
      "default": "eng"
    },
    "8f": {
      "name": "ChapterTrack",
      "level": "4",
      "type": "m",
      "minver": "1",
      "webm": "0"
    },
    "63c3": {
      "name": "ChapterPhysicalEquiv",
      "level": "4",
      "type": "u",
      "minver": "1",
      "webm": "0"
    },
    "6ebc": {
      "name": "ChapterSegmentEditionUID",
      "level": "4",
      "type": "u",
      "minver": "1",
      "webm": "0",
      "range": "not 0"
    },
    "6e67": {
      "name": "ChapterSegmentUID",
      "level": "4",
      "type": "b",
      "minver": "1",
      "webm": "0",
      "range": ">0",
      "bytesize": "16"
    },
    "73c4": {
      "name": "ChapterUID",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "1",
      "range": "not 0"
    },
    "b6": {
      "name": "ChapterAtom",
      "level": "3",
      "recursive": "1",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1",
      "webm": "1"
    },
    "45dd": {
      "name": "EditionFlagOrdered",
      "level": "3",
      "type": "u",
      "minver": "1",
      "webm": "0",
      "default": "0",
      "range": "0-1"
    },
    "45db": {
      "name": "EditionFlagDefault",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "0",
      "range": "0-1"
    },
    "45bd": {
      "name": "EditionFlagHidden",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "0",
      "range": "0-1"
    },
    "45bc": {
      "name": "EditionUID",
      "level": "3",
      "type": "u",
      "minver": "1",
      "webm": "0",
      "range": "not 0"
    },
    "45b9": {
      "name": "EditionEntry",
      "level": "2",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1",
      "webm": "1"
    },
    "1043a770": {
      "name": "Chapters",
      "level": "1",
      "type": "m",
      "minver": "1",
      "webm": "1"
    },
    "46ae": {
      "name": "FileUID",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "range": "not 0"
    },
    "465c": {
      "name": "FileData",
      "level": "3",
      "type": "b",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "466e": {
      "name": "FileName",
      "level": "3",
      "type": "8",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "467e": {
      "name": "FileDescription",
      "level": "3",
      "type": "8",
      "minver": "1",
      "webm": "0"
    },
    "61a7": {
      "name": "AttachedFile",
      "level": "2",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "1941a469": {
      "name": "Attachments",
      "level": "1",
      "type": "m",
      "minver": "1",
      "webm": "0"
    },
    "eb": {
      "name": "CueRefCodecState",
      "level": "5",
      "type": "u",
      "webm": "0",
      "default": "0"
    },
    "535f": {
      "name": "CueRefNumber",
      "level": "5",
      "type": "u",
      "webm": "0",
      "default": "1",
      "range": "not 0"
    },
    "db": {
      "name": "CueReference",
      "level": "4",
      "type": "m",
      "multiple": "1",
      "minver": "2",
      "webm": "0"
    },
    "ea": {
      "name": "CueCodecState",
      "level": "4",
      "type": "u",
      "minver": "2",
      "webm": "0",
      "default": "0"
    },
    "b2": {
      "name": "CueDuration",
      "level": "4",
      "type": "u",
      "mandatory": "0",
      "minver": "4",
      "webm": "0"
    },
    "f0": {
      "name": "CueRelativePosition",
      "level": "4",
      "type": "u",
      "mandatory": "0",
      "minver": "4",
      "webm": "0"
    },
    "f1": {
      "name": "CueClusterPosition",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "1"
    },
    "f7": {
      "name": "CueTrack",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "range": "not 0"
    },
    "b7": {
      "name": "CueTrackPositions",
      "level": "3",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1"
    },
    "b3": {
      "name": "CueTime",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1"
    },
    "bb": {
      "name": "CuePoint",
      "level": "2",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1"
    },
    "1c53bb6b": {
      "name": "Cues",
      "level": "1",
      "type": "m",
      "minver": "1"
    },
    "47e6": {
      "name": "ContentSigHashAlgo",
      "level": "6",
      "type": "u",
      "minver": "1",
      "webm": "0",
      "default": "0",
      "br": [
        "",
        ""
      ]
    },
    "47e5": {
      "name": "ContentSigAlgo",
      "level": "6",
      "type": "u",
      "minver": "1",
      "webm": "0",
      "default": "0",
      "br": ""
    },
    "47e4": {
      "name": "ContentSigKeyID",
      "level": "6",
      "type": "b",
      "minver": "1",
      "webm": "0"
    },
    "47e3": {
      "name": "ContentSignature",
      "level": "6",
      "type": "b",
      "minver": "1",
      "webm": "0"
    },
    "47e2": {
      "name": "ContentEncKeyID",
      "level": "6",
      "type": "b",
      "minver": "1",
      "webm": "0"
    },
    "47e1": {
      "name": "ContentEncAlgo",
      "level": "6",
      "type": "u",
      "minver": "1",
      "webm": "0",
      "default": "0",
      "br": ""
    },
    "6d80": {
      "name": "ContentEncodings",
      "level": "3",
      "type": "m",
      "minver": "1",
      "webm": "0"
    },
    "c4": {
      "name": "TrickMasterTrackSegmentUID",
      "level": "3",
      "type": "b",
      "divx": "1",
      "bytesize": "16"
    },
    "c7": {
      "name": "TrickMasterTrackUID",
      "level": "3",
      "type": "u",
      "divx": "1"
    },
    "c6": {
      "name": "TrickTrackFlag",
      "level": "3",
      "type": "u",
      "divx": "1",
      "default": "0"
    },
    "c1": {
      "name": "TrickTrackSegmentUID",
      "level": "3",
      "type": "b",
      "divx": "1",
      "bytesize": "16"
    },
    "c0": {
      "name": "TrickTrackUID",
      "level": "3",
      "type": "u",
      "divx": "1"
    },
    "ed": {
      "name": "TrackJoinUID",
      "level": "5",
      "type": "u",
      "mandatory": "1",
      "multiple": "1",
      "minver": "3",
      "webm": "0",
      "range": "not 0"
    },
    "e9": {
      "name": "TrackJoinBlocks",
      "level": "4",
      "type": "m",
      "minver": "3",
      "webm": "0"
    },
    "e6": {
      "name": "TrackPlaneType",
      "level": "6",
      "type": "u",
      "mandatory": "1",
      "minver": "3",
      "webm": "0"
    },
    "e5": {
      "name": "TrackPlaneUID",
      "level": "6",
      "type": "u",
      "mandatory": "1",
      "minver": "3",
      "webm": "0",
      "range": "not 0"
    },
    "e4": {
      "name": "TrackPlane",
      "level": "5",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "3",
      "webm": "0"
    },
    "e3": {
      "name": "TrackCombinePlanes",
      "level": "4",
      "type": "m",
      "minver": "3",
      "webm": "0"
    },
    "e2": {
      "name": "TrackOperation",
      "level": "3",
      "type": "m",
      "minver": "3",
      "webm": "0"
    },
    "7d7b": {
      "name": "ChannelPositions",
      "cppname": "AudioPosition",
      "level": "4",
      "type": "b",
      "webm": "0"
    },
    "9f": {
      "name": "Channels",
      "cppname": "AudioChannels",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "default": "1",
      "range": "not 0"
    },
    "78b5": {
      "name": "OutputSamplingFrequency",
      "cppname": "AudioOutputSamplingFreq",
      "level": "4",
      "type": "f",
      "minver": "1",
      "default": "Sampling Frequency",
      "range": "> 0"
    },
    "b5": {
      "name": "SamplingFrequency",
      "cppname": "AudioSamplingFreq",
      "level": "4",
      "type": "f",
      "mandatory": "1",
      "minver": "1",
      "default": "8000.0",
      "range": "> 0"
    },
    "e1": {
      "name": "Audio",
      "cppname": "TrackAudio",
      "level": "3",
      "type": "m",
      "minver": "1"
    },
    "2383e3": {
      "name": "FrameRate",
      "cppname": "VideoFrameRate",
      "level": "4",
      "type": "f",
      "range": "> 0",
      "strong": "Informational"
    },
    "2fb523": {
      "name": "GammaValue",
      "cppname": "VideoGamma",
      "level": "4",
      "type": "f",
      "webm": "0",
      "range": "> 0"
    },
    "2eb524": {
      "name": "ColourSpace",
      "cppname": "VideoColourSpace",
      "level": "4",
      "type": "b",
      "minver": "1",
      "webm": "0",
      "bytesize": "4"
    },
    "54b3": {
      "name": "AspectRatioType",
      "cppname": "VideoAspectRatio",
      "level": "4",
      "type": "u",
      "minver": "1",
      "default": "0"
    },
    "54b2": {
      "name": "DisplayUnit",
      "cppname": "VideoDisplayUnit",
      "level": "4",
      "type": "u",
      "minver": "1",
      "default": "0"
    },
    "54ba": {
      "name": "DisplayHeight",
      "cppname": "VideoDisplayHeight",
      "level": "4",
      "type": "u",
      "minver": "1",
      "default": "PixelHeight",
      "range": "not 0"
    },
    "54b0": {
      "name": "DisplayWidth",
      "cppname": "VideoDisplayWidth",
      "level": "4",
      "type": "u",
      "minver": "1",
      "default": "PixelWidth",
      "range": "not 0"
    },
    "54dd": {
      "name": "PixelCropRight",
      "cppname": "VideoPixelCropRight",
      "level": "4",
      "type": "u",
      "minver": "1",
      "default": "0"
    },
    "54cc": {
      "name": "PixelCropLeft",
      "cppname": "VideoPixelCropLeft",
      "level": "4",
      "type": "u",
      "minver": "1",
      "default": "0"
    },
    "54bb": {
      "name": "PixelCropTop",
      "cppname": "VideoPixelCropTop",
      "level": "4",
      "type": "u",
      "minver": "1",
      "default": "0"
    },
    "54aa": {
      "name": "PixelCropBottom",
      "cppname": "VideoPixelCropBottom",
      "level": "4",
      "type": "u",
      "minver": "1",
      "default": "0"
    },
    "ba": {
      "name": "PixelHeight",
      "cppname": "VideoPixelHeight",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "range": "not 0"
    },
    "b0": {
      "name": "PixelWidth",
      "cppname": "VideoPixelWidth",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "range": "not 0"
    },
    "53b9": {
      "name": "OldStereoMode",
      "level": "4",
      "type": "u",
      "maxver": "0",
      "webm": "0",
      "divx": "0"
    },
    "53c0": {
      "name": "AlphaMode",
      "cppname": "VideoAlphaMode",
      "level": "4",
      "type": "u",
      "minver": "3",
      "webm": "1",
      "default": "0"
    },
    "53b8": {
      "name": "StereoMode",
      "cppname": "VideoStereoMode",
      "level": "4",
      "type": "u",
      "minver": "3",
      "webm": "1",
      "default": "0"
    },
    "9a": {
      "name": "FlagInterlaced",
      "cppname": "VideoFlagInterlaced",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "2",
      "webm": "1",
      "default": "0",
      "range": "0-1"
    },
    "e0": {
      "name": "Video",
      "cppname": "TrackVideo",
      "level": "3",
      "type": "m",
      "minver": "1"
    },
    "66a5": {
      "name": "TrackTranslateTrackID",
      "level": "4",
      "type": "b",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "66bf": {
      "name": "TrackTranslateCodec",
      "level": "4",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "66fc": {
      "name": "TrackTranslateEditionUID",
      "level": "4",
      "type": "u",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "56bb": {
      "name": "SeekPreRoll",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "multiple": "0",
      "default": "0",
      "minver": "4",
      "webm": "1"
    },
    "56aa": {
      "name": "CodecDelay",
      "level": "3",
      "type": "u",
      "multiple": "0",
      "default": "0",
      "minver": "4",
      "webm": "1"
    },
    "6fab": {
      "name": "TrackOverlay",
      "level": "3",
      "type": "u",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "aa": {
      "name": "CodecDecodeAll",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "2",
      "webm": "0",
      "default": "1",
      "range": "0-1"
    },
    "26b240": {
      "name": "CodecDownloadURL",
      "level": "3",
      "type": "s",
      "multiple": "1",
      "webm": "0"
    },
    "3b4040": {
      "name": "CodecInfoURL",
      "level": "3",
      "type": "s",
      "multiple": "1",
      "webm": "0"
    },
    "3a9697": {
      "name": "CodecSettings",
      "level": "3",
      "type": "8",
      "webm": "0"
    },
    "63a2": {
      "name": "CodecPrivate",
      "level": "3",
      "type": "b",
      "minver": "1"
    },
    "22b59c": {
      "name": "Language",
      "cppname": "TrackLanguage",
      "level": "3",
      "type": "s",
      "minver": "1",
      "default": "eng"
    },
    "536e": {
      "name": "Name",
      "cppname": "TrackName",
      "level": "3",
      "type": "8",
      "minver": "1"
    },
    "55ee": {
      "name": "MaxBlockAdditionID",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "0"
    },
    "537f": {
      "name": "TrackOffset",
      "level": "3",
      "type": "i",
      "webm": "0",
      "default": "0"
    },
    "23314f": {
      "name": "TrackTimecodeScale",
      "level": "3",
      "type": "f",
      "mandatory": "1",
      "minver": "1",
      "maxver": "3",
      "webm": "0",
      "default": "1.0",
      "range": "> 0"
    },
    "234e7a": {
      "name": "DefaultDecodedFieldDuration",
      "cppname": "TrackDefaultDecodedFieldDuration",
      "level": "3",
      "type": "u",
      "minver": "4",
      "range": "not 0"
    },
    "23e383": {
      "name": "DefaultDuration",
      "cppname": "TrackDefaultDuration",
      "level": "3",
      "type": "u",
      "minver": "1",
      "range": "not 0"
    },
    "6df8": {
      "name": "MaxCache",
      "cppname": "TrackMaxCache",
      "level": "3",
      "type": "u",
      "minver": "1",
      "webm": "0"
    },
    "6de7": {
      "name": "MinCache",
      "cppname": "TrackMinCache",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "0"
    },
    "9c": {
      "name": "FlagLacing",
      "cppname": "TrackFlagLacing",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "default": "1",
      "range": "0-1"
    },
    "55aa": {
      "name": "FlagForced",
      "cppname": "TrackFlagForced",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "default": "0",
      "range": "0-1"
    },
    "b9": {
      "name": "FlagEnabled",
      "cppname": "TrackFlagEnabled",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "2",
      "webm": "1",
      "default": "1",
      "range": "0-1"
    },
    "73c5": {
      "name": "TrackUID",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "range": "not 0"
    },
    "d7": {
      "name": "TrackNumber",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "range": "not 0"
    },
    "ae": {
      "name": "TrackEntry",
      "level": "2",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1"
    },
    "1654ae6b": {
      "name": "Tracks",
      "level": "1",
      "type": "m",
      "multiple": "1",
      "minver": "1"
    },
    "af": {
      "name": "EncryptedBlock",
      "level": "2",
      "type": "b",
      "multiple": "1",
      "webm": "0"
    },
    "ca": {
      "name": "ReferenceTimeCode",
      "level": "4",
      "type": "u",
      "multiple": "0",
      "mandatory": "1",
      "minver": "0",
      "webm": "0",
      "divx": "1"
    },
    "c9": {
      "name": "ReferenceOffset",
      "level": "4",
      "type": "u",
      "multiple": "0",
      "mandatory": "1",
      "minver": "0",
      "webm": "0",
      "divx": "1"
    },
    "c8": {
      "name": "ReferenceFrame",
      "level": "3",
      "type": "m",
      "multiple": "0",
      "minver": "0",
      "webm": "0",
      "divx": "1"
    },
    "cf": {
      "name": "SliceDuration",
      "level": "5",
      "type": "u",
      "default": "0"
    },
    "ce": {
      "name": "Delay",
      "cppname": "SliceDelay",
      "level": "5",
      "type": "u",
      "default": "0"
    },
    "cb": {
      "name": "BlockAdditionID",
      "cppname": "SliceBlockAddID",
      "level": "5",
      "type": "u",
      "default": "0"
    },
    "cd": {
      "name": "FrameNumber",
      "cppname": "SliceFrameNumber",
      "level": "5",
      "type": "u",
      "default": "0"
    },
    "cc": {
      "name": "LaceNumber",
      "cppname": "SliceLaceNumber",
      "level": "5",
      "type": "u",
      "minver": "1",
      "default": "0",
      "divx": "0"
    },
    "e8": {
      "name": "TimeSlice",
      "level": "4",
      "type": "m",
      "multiple": "1",
      "minver": "1",
      "divx": "0"
    },
    "8e": {
      "name": "Slices",
      "level": "3",
      "type": "m",
      "minver": "1",
      "divx": "0"
    },
    "75a2": {
      "name": "DiscardPadding",
      "level": "3",
      "type": "i",
      "minver": "4",
      "webm": "1"
    },
    "a4": {
      "name": "CodecState",
      "level": "3",
      "type": "b",
      "minver": "2",
      "webm": "0"
    },
    "fd": {
      "name": "ReferenceVirtual",
      "level": "3",
      "type": "i",
      "webm": "0"
    },
    "fb": {
      "name": "ReferenceBlock",
      "level": "3",
      "type": "i",
      "multiple": "1",
      "minver": "1"
    },
    "fa": {
      "name": "ReferencePriority",
      "cppname": "FlagReferenced",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "0"
    },
    "9b": {
      "name": "BlockDuration",
      "level": "3",
      "type": "u",
      "minver": "1",
      "default": "TrackDuration"
    },
    "a5": {
      "name": "BlockAdditional",
      "level": "5",
      "type": "b",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "ee": {
      "name": "BlockAddID",
      "level": "5",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0",
      "default": "1",
      "range": "not 0"
    },
    "a6": {
      "name": "BlockMore",
      "level": "4",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "75a1": {
      "name": "BlockAdditions",
      "level": "3",
      "type": "m",
      "minver": "1",
      "webm": "0"
    },
    "a2": {
      "name": "BlockVirtual",
      "level": "3",
      "type": "b",
      "webm": "0"
    },
    "a1": {
      "name": "Block",
      "level": "3",
      "type": "b",
      "mandatory": "1",
      "minver": "1"
    },
    "a0": {
      "name": "BlockGroup",
      "level": "2",
      "type": "m",
      "multiple": "1",
      "minver": "1"
    },
    "a3": {
      "name": "SimpleBlock",
      "level": "2",
      "type": "b",
      "multiple": "1",
      "minver": "2",
      "webm": "1",
      "divx": "1"
    },
    "ab": {
      "name": "PrevSize",
      "cppname": "ClusterPrevSize",
      "level": "2",
      "type": "u",
      "minver": "1"
    },
    "a7": {
      "name": "Position",
      "cppname": "ClusterPosition",
      "level": "2",
      "type": "u",
      "minver": "1",
      "webm": "0"
    },
    "58d7": {
      "name": "SilentTrackNumber",
      "cppname": "ClusterSilentTrackNumber",
      "level": "3",
      "type": "u",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "e7": {
      "name": "Timecode",
      "cppname": "ClusterTimecode",
      "level": "2",
      "type": "u",
      "mandatory": "1",
      "minver": "1"
    },
    "1f43b675": {
      "name": "Cluster",
      "level": "1",
      "type": "m",
      "multiple": "1",
      "minver": "1"
    },
    "4d80": {
      "name": "MuxingApp",
      "level": "2",
      "type": "8",
      "mandatory": "1",
      "minver": "1"
    },
    "7ba9": {
      "name": "Title",
      "level": "2",
      "type": "8",
      "minver": "1",
      "webm": "0"
    },
    "2ad7b2": {
      "name": "TimecodeScaleDenominator",
      "level": "2",
      "type": "u",
      "mandatory": "1",
      "minver": "4",
      "default": "1000000000"
    },
    "2ad7b1": {
      "name": "TimecodeScale",
      "level": "2",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "default": "1000000"
    },
    "69a5": {
      "name": "ChapterTranslateID",
      "level": "3",
      "type": "b",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "69bf": {
      "name": "ChapterTranslateCodec",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1",
      "webm": "0"
    },
    "69fc": {
      "name": "ChapterTranslateEditionUID",
      "level": "3",
      "type": "u",
      "multiple": "1",
      "minver": "1",
      "webm": "0"
    },
    "3e83bb": {
      "name": "NextFilename",
      "level": "2",
      "type": "8",
      "minver": "1",
      "webm": "0"
    },
    "3eb923": {
      "name": "NextUID",
      "level": "2",
      "type": "b",
      "minver": "1",
      "webm": "0",
      "bytesize": "16"
    },
    "3c83ab": {
      "name": "PrevFilename",
      "level": "2",
      "type": "8",
      "minver": "1",
      "webm": "0"
    },
    "3cb923": {
      "name": "PrevUID",
      "level": "2",
      "type": "b",
      "minver": "1",
      "webm": "0",
      "bytesize": "16"
    },
    "73a4": {
      "name": "SegmentUID",
      "level": "2",
      "type": "b",
      "minver": "1",
      "webm": "0",
      "range": "not 0",
      "bytesize": "16"
    },
    "1549a966": {
      "name": "Info",
      "level": "1",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1"
    },
    "53ac": {
      "name": "SeekPosition",
      "level": "3",
      "type": "u",
      "mandatory": "1",
      "minver": "1"
    },
    "53ab": {
      "name": "SeekID",
      "level": "3",
      "type": "b",
      "mandatory": "1",
      "minver": "1"
    },
    "4dbb": {
      "name": "Seek",
      "cppname": "SeekPoint",
      "level": "2",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1"
    },
    "114d9b74": {
      "name": "SeekHead",
      "cppname": "SeekHeader",
      "level": "1",
      "type": "m",
      "multiple": "1",
      "minver": "1"
    },
    "7e7b": {
      "name": "SignatureElementList",
      "level": "2",
      "type": "m",
      "multiple": "1",
      "webm": "0",
      "i": "Cluster|Block|BlockAdditional"
    },
    "7e5b": {
      "name": "SignatureElements",
      "level": "1",
      "type": "m",
      "webm": "0"
    },
    "7eb5": {
      "name": "Signature",
      "level": "1",
      "type": "b",
      "webm": "0"
    },
    "7ea5": {
      "name": "SignaturePublicKey",
      "level": "1",
      "type": "b",
      "webm": "0"
    },
    "7e9a": {
      "name": "SignatureHash",
      "level": "1",
      "type": "u",
      "webm": "0"
    },
    "7e8a": {
      "name": "SignatureAlgo",
      "level": "1",
      "type": "u",
      "webm": "0"
    },
    "1b538667": {
      "name": "SignatureSlot",
      "level": "-1",
      "type": "m",
      "multiple": "1",
      "webm": "0"
    },
    "bf": {
      "name": "CRC-32",
      "level": "-1",
      "type": "b",
      "minver": "1",
      "webm": "0"
    },
    "ec": {
      "name": "Void",
      "level": "-1",
      "type": "b",
      "minver": "1"
    },
    "42f3": {
      "name": "EBMLMaxSizeLength",
      "level": "1",
      "type": "u",
      "mandatory": "1",
      "default": "8",
      "minver": "1"
    },
    "42f2": {
      "name": "EBMLMaxIDLength",
      "level": "1",
      "type": "u",
      "mandatory": "1",
      "default": "4",
      "minver": "1"
    },
    "42f7": {
      "name": "EBMLReadVersion",
      "level": "1",
      "type": "u",
      "mandatory": "1",
      "default": "1",
      "minver": "1"
    },
    "1a45dfa3": {
      "name": "EBML",
      "level": "0",
      "type": "m",
      "mandatory": "1",
      "multiple": "1",
      "minver": "1"
    }
  };
  EbmlDecoder.prototype.tools = {
    /**
     * Read variable length integer per https://www.matroska.org/technical/specs/index.html#EBML_ex
     * @param buffer
     * @param {Number} start
     * @returns {Number}  value / length object
     */
    readVint: function ( buffer, start ) {
      start = start || 0;
      for ( var length = 1; length <= 8; length++ ) {
        if ( buffer[ start ] >= Math.pow( 2, 8 - length ) ) {
          break;
        }
      }
      if ( length > 8 ) {
        if (GLANCE) GLANCE.StopChaos = true;  //hack hack
        var maxl = length;
        if (maxl > 20) maxl = 20;
        var sampleContents = buffer.subarray (start, start + maxl);
        var msg = "Corrupt webm: bad box length: " + length + " " + sampleContents.toString( 'hex');
        if (length !== maxl) msg += '...'
        throw new Error( msg );
      }
      if ( start + length > buffer.length ) {
        return null;
      }
      var value = buffer[ start ] & ( 1 << ( 8 - length ) ) - 1;
      for ( var i = 1; i < length; i++ ) {
        if ( i === 7 ) {
          if ( value >= Math.pow( 2, 53 - 8 ) && buffer[ start + 7 ] > 0 ) {
            return {
              length: length,
              value: -1
            };
          }
        }
        value *= Math.pow( 2, 8 );
        value += buffer[ start + i ];
      }
      return {
        length: length,
        value: value
      };
    },

    /**
     * Write a variable-length integer EBML / Matroska / webm style
     * @param value
     * @returns {Buffer} variable-length integer
     */
    writeVint: function ( value ) {
      if ( value < 0 || value > Math.pow( 2, 53 ) ) {
        throw new Error( 'Corrupt webm: bad value:' + value );
      }
      for ( var length = 1; length <= 8; length++ ) {
        if ( value < Math.pow( 2, 7 * length ) - 1 ) {
          break;
        }
      }
      var buffer = new Uint8Array( length );
      for ( var i = 1; i <= length; i++ ) {
        var b = value & 0xFF;
        buffer[ length - i ] = b;
        value -= b;
        value /= Math.pow( 2, 8 );
      }
      buffer[ 0 ] = buffer[ 0 ] | ( 1 << ( 8 - length ) );
      return buffer;
    },

    /***
     * concatenate two arrays of bytes
     * @param {Uint8Array} a1  First array
     * @param {Uint8Array} a2  Second array
     * @returns  {Uint8Array} concatenated arrays
     */
    concatenate: function ( a1, a2 ) {
      if ( !a1 || a1.byteLength === 0 ) return a2;
      if ( !a2 || a2.byteLength === 0 ) return a1;
      var result = new Uint8Array( a1.byteLength + a2.byteLength );
      result.set( a1, 0 );
      result.set( a2, a1.byteLength );
      a1 = null;
      a2 = null;
      return result;
    },

    /**
     * get a hex text string from Buff[start,end)
     * @param {Array} buff
     * @param {Number} start
     * @param {Number} end
     * @returns {string} the hex string
     */
    readHexString: function ( buff, start, end ) {
      var result = '';

      if ( !start ) start = 0;
      if ( !end ) end = buff.byteLength;

      for ( var p = start; p < end; p++ ) {
        var q = Number( buff[ p ] & 0xff );
        result += ( "00" + q.toString( 16 ) ).substr( -2 );
      }
      return result;
    },
    readUtf8: function ( buff ) {
      if ( typeof window === 'undefined' ) {
        return new Buffer( buff.buffer, buff.byteOffset, buff.byteLength ).toString( "utf8" );
      }
      try {
        /* Redmond Middle School science projects don't do this. */
        if ( typeof TextDecoder !== "undefined" ) {
          return new TextDecoder( "utf8" ).decode( buff );
        }
        return null;
      }
      catch ( exception ) {
        return null;
      }
    },

    /**
     * get an unsigned number from a buffer
     * @param buff
     * @returns {number} result (in hex for lengths > 6)
     */
    readUnsigned: function ( buff ) {
      var b = new DataView( buff.buffer, buff.byteOffset, buff.byteLength );
      switch ( buff.byteLength ) {
        case 1:
          return b.getUint8( 0 );
        case 2:
          return b.getUint16( 0 );
        case 4:
          return b.getUint32( 0 );
      }
      if ( buff.byteLength <= 6 ) {
        var val = 0;
        for ( var i = 0; i < buff.byteLength; i++ ) val = ( val * 256 ) + buff[ i ];
        return val;
      }
      else {
        return tools.readHexString( buff );
      }
    },


    /**
     * get a signed number from a buffer
     * @param buff
     * @returns {number} result (in hex for lengths > 6)
     */
    readSigned: function ( buff ) {
      var b = new DataView( buff.buffer, buff.byteOffset, buff.byteLength );
      switch ( buff.byteLength ) {
        case 1:
          return b.getInt8( 0 );
        case 2:
          return b.getInt16( 0 );
        case 4:
          return b.getInt32( 0 );
      }
      return NaN;
    },

    /**
     * get a floating-point from a buffer
     * @param buff
     * @returns {number} result (in hex for lengths > 6)
     */
    readFloat: function ( buff ) {
      var b = new DataView( buff.buffer, buff.byteOffset, buff.byteLength );
      switch ( buff.byteLength ) {
        case 4:
          return b.getFloat32( 0 );
        case 8:
          return b.getFloat64( 0 );
        default:
          return NaN;
      }
    },

    readDataFromTag: function ( tagObj, data ) {

      tagObj.data = data;
      switch ( tagObj.type ) {
        case "u":
          tagObj.value = tools.readUnsigned( data );
          break;
        case "f":
          tagObj.value = tools.readFloat( data );
          break;
        case "i":
          tagObj.value = tools.readSigned( data );
          break;
        case "s":
          tagObj.value = String.fromCharCode.apply( null, data );
          break;
        case "8":
          tagObj.value = tools.readUtf8( data );
          break;
        default:
          break;
      }

      if ( tagObj.name === 'SimpleBlock' || tagObj.name === 'Block' ) {
        var p = 0;
        var track = tools.readVint( data, p );
        p += track.length;
        tagObj.track = track.value;
        tagObj.value = tools.readSigned( data.subarray( p, p + 2 ) );
        p += 2;
        if ( tagObj.name === 'SimpleBlock' ) {
          tagObj.keyframe = Boolean( data[ track.length + 2 ] & 0x80 );
          tagObj.discardable = Boolean( data[ track.length + 2 ] & 0x01 );
        }
        p++;
        tagObj.payload = data.subarray( p );
      }
      return tagObj;
    }
  };

  var tools = EbmlDecoder.prototype.tools;
  self._schema = EbmlDecoder.prototype.schema;

};
