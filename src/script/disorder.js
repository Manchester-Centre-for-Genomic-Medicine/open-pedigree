import { isInt } from 'pedigree/model/helpers';
/*
 * Disorder is a class for storing genetic disorder info and loading it from the
 * the Orphanet database. These disorders can be attributed to an individual in the Pedigree.
 *
 * @param disorderID the id number for the disorder, taken from the Orphanet database
 * @param name a string representing the name of the disorder e.g. "Down Syndrome"
 */

var Disorder = Class.create( {

  initialize: function(disorderID, name, callWhenReady, source = 'ORPHA') {
    // In case ID is a number.
    if (disorderID) {
      disorderID = disorderID.toString();
    }
    // user-defined disorders
    if (name == null && !isInt(disorderID)) {
      name = Disorder.desanitizeID(disorderID);
    }
    // Code of the original Open Pedigree disorder class.
    //this._disorderID = Disorder.sanitizeID(disorderID);
    //this._name       = name ? name : 'loading...';

    // Load disorder id and name from display name.
    if (disorderID == null && name.includes(' | ')) {
      var disorderInfo = name.split(' | ');
      
      if (disorderInfo[0].includes(':')) {
        var disorderIDParts = disorderInfo[0].split(':');
        this._source = disorderIDParts[0];
        this._disorderID = Disorder.sanitizeID(disorderIDParts[1]);
      }
      else {
        this._source = source;
        this._disorderID = Disorder.sanitizeID(disorderInfo[0]);
      }
      this._name  = disorderInfo[1];
    } else {
      this._disorderID  = Disorder.sanitizeID(disorderID);
      this._name   = name ? name : 'loading...';
      this._source = source;
    }

    if (!name && callWhenReady) {
      this.load(callWhenReady);
    }
  },

  /*
     * Returns the disorderID of the disorder
     */
  getDisorderID: function() {
    return this._disorderID;
  },

  /*
    * Returns the disorderID of the disorder
    */
  getDesanitizedDisorderID: function() {
    return Disorder.desanitizeID(this._disorderID);
  },

  /*
     * Returns the name of the disorder
     */
  getName: function() {
    return this._name;
  },

  /*
    * Returns the display name of the term in format "hpoID | name"
    */
  getDisplayName: function() {
    return this._source + ':' + Disorder.desanitizeID(this._disorderID) + ' | ' + this._name;
  },

  load: function(callWhenReady) {
    var _this = this;
    jQuery.ajax({
      url: `https://api.orphacode.org/EN/ClinicalEntity/orphacode/${this._disorderID}/Name`,
      type: 'GET',
      headers: {
        // ORPHA requires api key, but it can be anything.
        'apikey': '5d29dd2f-8021-41e2-8146-3548d7ba409b'
      },
      async: true,
      error: _this.onDataError.bind(_this),
      success: _this.onDataReady.bind(_this),
      complete: callWhenReady ? callWhenReady : {},
    });

    /*
    // Code of the original Open Pedigree disorder class.
    var baseOMIMServiceURL = Disorder.getOMIMServiceURL();
    var queryURL           = baseOMIMServiceURL + '&q=id:' + this._disorderID;
    //console.log("queryURL: " + queryURL);
    new Ajax.Request(queryURL, {
      method: 'GET',
      onSuccess: this.onDataReady.bind(this),
      //onComplete: complete.bind(this)
      onComplete: callWhenReady ? callWhenReady : {}
    });
    */
  },

  onDataError : function(response) {
    var err = response.responseJSON;
    this._name = err.title;
    console.log('ORPHANET API ERROR: title = ' + err.title + ', detail = ' + err.detail + ', status = ' + err.status);
  },

  onDataReady : function(response) {
    try {
      this._name = response['Preferred term'];
      console.log('LOADED DISORDER: disorder id = ' + this._disorderID + ', name = ' + this._name);
      /*
      // Code of the original Open Pedigree disorder class.
      var parsed = JSON.parse(response.responseText);
      //console.log(JSON.stringify(parsed));
      console.log('LOADED DISORDER: disorder id = ' + this._disorderID + ', name = ' + parsed.rows[0].name);
      this._name = parsed.rows[0].name;
      */
    } catch (err) {
      this._name = 'Failed to parse API response';
      console.log('[LOAD DISORDER] Error: ' +  err);
    }
  }
});

/*
 * IDs are used as part of HTML IDs in the Legend box, which breaks when IDs contain some non-alphanumeric symbols.
 * For that purpose these symbols in IDs are converted in memory (but not in the stored pedigree) to some underscores.
 */
Disorder.sanitizeID = function(disorderID) {
  if (isInt(disorderID)) {
    return disorderID;
  }
  var temp = disorderID.replace(/[\(\[]/g, '_L_');
  temp = temp.replace(/[\)\]]/g, '_J_');
  return temp.replace(/[^a-zA-Z0-9,;_\-*]/g, '__');
};

Disorder.desanitizeID = function(disorderID) {
  var temp = disorderID.replace(/__/g, ' ');
  temp = temp.replace(/_L_/g, '(');
  return temp.replace(/_J_/g, ')');
};

/*
// Code of the original Open Pedigree disorder class.
Disorder.getOMIMServiceURL = function() {
  return new XWiki.Document('OmimService', 'PhenoTips').getURL('get', 'outputSyntax=plain');
};
*/
export default Disorder;
