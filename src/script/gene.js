/*
 * Gene is a class for storing gene information and from HGNC database.
 * These genes can be attributed to an individual in the Pedigree.
 *
 * @param hgncID the id number for the gene, taken from the HGNC database
 * @param symbol a string representing the symbol of the gene (sometimes also called name)
 */

var Gene = Class.create( {

  initialize: function(hgncID, symbol, group) {
    // Load HGNC ID and symbol from the display name.
    if (hgncID == null && symbol.includes(' | ')) {
      var geneInfo = symbol.split(' | ');
      this._hgncID = geneInfo[0];
      this._symbol = geneInfo[1];
    } else {
      this._hgncID = hgncID ? hgncID : '-';
      this._symbol = symbol;
    }
    this._group = group ? group : '';
  },

  /*
     * Returns the HGNC ID of the gene
     */
  getID: function() {
    return this._hgncID;
  },

  /*
     * Returns the symbol of the gene
     */
  getSymbol: function() {
    //return this._hgncID;
    return this._symbol;
  },

  /*
    * Returns the group of the gene
    */
  getGroup: function() {
    return this._group;
  },

  /*
     * Returns the display name of a gene in format "HGNC ID | symbol"
     */
  getDisplayName: function() {
    return this._hgncID + ' | ' + this._symbol;
  },
});

export default Gene;