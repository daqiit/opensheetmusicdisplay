//https://github.com/davidchambers/Base64.js

; (function () {
  var object = typeof exports != 'undefined' ? exports : this; // #8: web workers
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  function InvalidCharacterError(message) {
    this.message = message;
  }
  InvalidCharacterError.prototype = new Error;
  InvalidCharacterError.prototype.name = 'InvalidCharacterError';

  // encoder
  // [https://gist.github.com/999166] by [https://github.com/nignag]
  object.btoa || (
    object.btoa = function (input) {
      for (
        // initialize result and counter
        var block, charCode, idx = 0, map = chars, output = '';
        // if the next input index does not exist:
        //   change the mapping table to "="
        //   check if d has no fractional digits
        input.charAt(idx | 0) || (map = '=', idx % 1);
        // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
        output += map.charAt(63 & block >> 8 - idx % 1 * 8)
      ) {
        charCode = input.charCodeAt(idx += 3 / 4);
        if (charCode > 0xFF) {
          throw new InvalidCharacterError("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
        }
        block = block << 8 | charCode;
      }
      return output;
    });

  // decoder
  // [https://gist.github.com/1020396] by [https://github.com/atk]
  object.atob || (
    object.atob = function (input) {
      input = input.replace(/=+$/, '')
      if (input.length % 4 == 1) {
        throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
      }
      for (
        // initialize result and counters
        var bc = 0, bs, buffer, idx = 0, output = '';
        // get next character
        buffer = input.charAt(idx++);
        // character found in table? initialize bit storage and add its ascii value;
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
          // and if not first of each 4 characters,
          // convert the first 8 bits to one ascii character
          bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
      ) {
        // try to find character in table (0-63, not found => -1)
        buffer = chars.indexOf(buffer);
      }
      return output;
    });

    object.encode || (
      object.encode = function (input) { 
    var output = ""; 
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4; 
    var i = 0; 
    input = _utf8_encode(input); 
    while (i < input.length) { 
      chr1 = input.charCodeAt(i++); 
      chr2 = input.charCodeAt(i++); 
      chr3 = input.charCodeAt(i++); 
      enc1 = chr1 >> 2; 
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4); 
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6); 
      enc4 = chr3 & 63; 
      if (isNaN(chr2)) { 
        enc3 = enc4 = 64; 
      } else if (isNaN(chr3)) { 
        enc4 = 64; 
      } 
      output = output + chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4); 
    } 
    return output; 
  });  
  
  // public method for decoding      
  object.decode || (
    object.decode = function (input) {          
    var output = "";          
    var chr1, chr2, chr3;          
    var enc1, enc2, enc3, enc4;          
    var i = 0;          
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");          
    while (i < input.length) {              
      enc1 = chars.indexOf(input.charAt(i++));              
      enc2 = chars.indexOf(input.charAt(i++));              
      enc3 = chars.indexOf(input.charAt(i++));              
      enc4 = chars.indexOf(input.charAt(i++));              
      chr1 = (enc1 << 2) | (enc2 >> 4);              
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);              
      chr3 = ((enc3 & 3) << 6) | enc4;              
      output = output + String.fromCharCode(chr1);              
      if (enc3 != 64) {                  
        output = output + String.fromCharCode(chr2);              
      }              
      if (enc4 != 64) {                  
        output = output + String.fromCharCode(chr3);              
      }          
    }          
    output = _utf8_decode(output);          
    return output;      
  } );

  // private method for UTF-8 encoding      
  _utf8_encode = function (string) {          
    string = string.replace(/\r\n/g,"\n");          
    var utftext = "";          
    for (var n = 0; n < string.length; n++) {              
      var c = string.charCodeAt(n);              
      if (c < 128) {                  
        utftext += String.fromCharCode(c);              
      } else if((c > 127) && (c < 2048)) {                  
        utftext += String.fromCharCode((c >> 6) | 192);                  
        utftext += String.fromCharCode((c & 63) | 128);              
      } else {                  
        utftext += String.fromCharCode((c >> 12) | 224);                  
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);                  
        utftext += String.fromCharCode((c & 63) | 128);              
      }           
    }          
    return utftext;      
  }       
  // private method for UTF-8 decoding      
  _utf8_decode = function (utftext) {          
    var string = "";          
    var i = 0;          
    var c = c1 = c2 = 0;          
    while ( i < utftext.length ) {              
      c = utftext.charCodeAt(i);              
      if (c < 128) {                  
        string += String.fromCharCode(c);                  
        i++;              
      } else if((c > 191) && (c < 224)) {                  
        c2 = utftext.charCodeAt(i+1);                  
        string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));                  
        i += 2;              
      } else {                  
        c2 = utftext.charCodeAt(i+1);                  
        c3 = utftext.charCodeAt(i+2);                  
        string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));                  
        i += 3;              
      }          
    }          
    return string;      
  }  

}());