/*
 * HPOTerm is a class for storing phenotype information and loading it from the
 * the HPO database. These phenotypes can be attributed to an individual in the Pedigree.
 *
 * @param hpoID the id number for the HPO term, taken from the HPO database
 * @param name a string representing the name of the term e.g. "Abnormality of the eye"
 */

var HPOTerm = Class.create( {

  initialize: function(hpoID, name, callWhenReady) {
    // user-defined terms
    if (name == null && !HPOTerm.isValidID(HPOTerm.desanitizeID(hpoID))) {
      name = HPOTerm.desanitizeID(hpoID);
    }

    // Load hpo id and name from display name.
    if (hpoID == null && name.includes(' | ')) {
      var hpoInfo = name.split(' | ');
      this._hpoID = HPOTerm.sanitizeID(hpoInfo[0]);
      this._name  = hpoInfo[1];
    } else {
      this._hpoID  = HPOTerm.sanitizeID(hpoID);
      this._name   = name ? name : 'loading...';
    }

    if (!name && callWhenReady) {
      this.load(callWhenReady);
    }
  },

  /*
     * Returns the hpoID of the phenotype
     */
  getID: function() {
    return this._hpoID;
  },

  /*
    * Returns the desanitized hpoID of the phenotype
    */
  getDesanitizedID: function() {
    return HPOTerm.desanitizeID(this._hpoID);
  },

  /*
     * Returns the name of the term
     */
  getName: function() {
    return this._name;
  },

  /*
     * Returns the display name of the term in format "hpoID | name"
     */
  getDisplayName: function() {
    return HPOTerm.desanitizeID(this._hpoID) + ' | ' + this._name; //this._displayName;
  },

  load: function(callWhenReady) {
    var _this = this;
    jQuery.ajax({
      url: 'https://hpo.jax.org/api/hpo/term/' + encodeURIComponent(HPOTerm.desanitizeID(this._hpoID)),
      type: 'GET',
      async: true,
      error: _this.onDataError.bind(_this),
      success: _this.onDataReady.bind(_this),
      complete: callWhenReady ? callWhenReady : {},
    });

    /*
    // Code of the original Open Pedigree HPO term class.
    var baseServiceURL = HPOTerm.getServiceURL();
    var queryURL       = baseServiceURL + '&q=id%3A' + HPOTerm.desanitizeID(this._hpoID).replace(':','%5C%3A');
    //console.log("QueryURL: " + queryURL);
    new Ajax.Request(queryURL, {
      method: 'GET',
      onSuccess: this.onDataReady.bind(this),
      //onComplete: complete.bind(this)
      onComplete: callWhenReady ? callWhenReady : {}
    });
    */
  },

  onDataError : function(response) {
    console.log('onDataError', response);
    var err = response.responseJSON;
    this._name = err.message;
    console.log('ORPHANET API ERROR: error = ' + err.error + ', message = ' + err.message);
  },

  onDataReady : function(response) {
    console.log('onDataReady', response);
    try {
      this._name = response.details.name;
      console.log('LOADED HPO TERM: id = ' + HPOTerm.desanitizeID(this._hpoID) + ', name = ' + this._name);
    } catch (err) {
      console.log('[LOAD HPO TERM] Error: ' +  err);
    }
    /*
    // Code of the original Open Pedigree HPO term class.
    try {
      var parsed = JSON.parse(response.responseText);
      //console.log(JSON.stringify(parsed));
      console.log('LOADED HPO TERM: id = ' + HPOTerm.desanitizeID(this._hpoID) + ', name = ' + parsed.rows[0].name);
      this._name = parsed.rows[0].name;
    } catch (err) {
      console.log('[LOAD HPO TERM] Error: ' +  err);
    }
    */
  }
});

/*
 * IDs are used as part of HTML IDs in the Legend box, which breaks when IDs contain some non-alphanumeric symbols.
 * For that purpose these symbols in IDs are converted in memory (but not in the stored pedigree) to some underscores.
 */
HPOTerm.sanitizeID = function(id) {
  var temp = id.replace(/[\(\[]/g, '_L_');
  temp = temp.replace(/[\)\]]/g, '_J_');
  temp = temp.replace(/[:]/g, '_C_');
  return temp.replace(/[^a-zA-Z0-9,;_\-*]/g, '__');
};

HPOTerm.desanitizeID = function(id) {
  var temp = id.replace(/__/g, ' ');
  temp = temp.replace(/_C_/g, ':');
  temp = temp.replace(/_L_/g, '(');
  return temp.replace(/_J_/g, ')');
};

HPOTerm.isValidID = function(id) {
  var pattern = /^HP\:(\d)+$/i;
  return pattern.test(id);
};

/*
// Code of the original Open Pedigree HPO term class.
HPOTerm.getServiceURL = function() {
  //return new XWiki.Document('SolrService', 'PhenoTips').getURL('get') + '?';
  // This suggestion from the link doues not work, 
  // but some valid link is needed to input HPO terms as free text.
  return 'https://raw.githubusercontent.com/obophenotype/human-phenotype-ontology/master/hp.obo?'
};
*/
export default HPOTerm;
