import HPOTerm from 'pedigree/hpoTerm';
import Raphael from 'pedigree/raphael';
import Legend from 'pedigree/view/legend';

/**
 * Class responsible for keeping track of HPO terms and their properties, and for
 * caching disorders data as loaded from the OMIM database.
 * This information is graphically displayed in a 'Legend' box
 *
 * @class HPOLegend
 * @constructor
 */
var HPOLegend = Class.create( Legend, {

  initialize: function($super) {
    $super('Phenotypes');

    this._termCache = {};
  },

  _getPrefix: function(id) {
    return 'phenotype';
  },

  /**
     * Returns the HPOTerm object with the given ID. If object is not in cache yet
     * returns a newly created one which may have the term name & other attributes not loaded yet
     *
     * @method getTerm
     * @return {Object}
     */
  getTerm: function(hpoID) {
    hpoID = HPOTerm.sanitizeID(hpoID);
    if (!this._termCache.hasOwnProperty(hpoID)) {
      var whenNameIsLoaded = function() {
        this._updateTermName(hpoID);
      };
      this._termCache[hpoID] = new HPOTerm(hpoID, null, whenNameIsLoaded.bind(this));
    }
    return this._termCache[hpoID];
  },

  /**
     * Registers an occurrence of a phenotype.
     *
     * @method addCase
     * @param {Number|String} id ID for this term taken from the HPO database
     * @param {String} name The description of the phenotype
     * @param {Number} nodeID ID of the Person who has this phenotype
     */
  addCase: function($super, id, name, nodeID) {
    if (!this._termCache.hasOwnProperty(id)) {
      this._termCache[id] = new HPOTerm(id, name);
    }

    $super(id, name, nodeID);
  },

  /**
     * Updates the displayed phenotype name for the given phenotype
     *
     * @method _updateTermName
     * @param {Number} id The identifier of the phenotype to update
     * @private
     */
  _updateTermName: function(id) {
    var name = this._legendBox.down('li#' + this._getPrefix() + '-' + id + ' .disorder-name');
    name.update(this.getTerm(id).getName());
  },

  /**
     * Generate the element that will display information about the given hpo in the legend
     *
     * @method _generateElement
     * @param {String} id The id for the hpo term
     * @param {String} name The human-readable gene description
     * @return {HTMLLIElement} List element to be insert in the legend
     */
   _generateElement: function($super, id, name) {
    if (!this._objectColors.hasOwnProperty(id) && this._showColors) {
      var color = this._generateColor(id);
      this._objectColors[id] = color;
      document.fire('hpo:color', {'id' : id, color: color});
    }

    return $super(id, name);
  },

  /**
     * Generates a CSS color.
     * Has preference for some predefined colors that can be distinguished in gray-scale
     *
     * @method generateColor
     * @return {String} CSS color
     */
  _generateColor: function(id) {
    if(this._objectColors.hasOwnProperty(id)) {
      return this._objectColors[id];
    }

    var usedColors = Object.values(this._objectColors),
      // RColorBrewer "Paired" palette
      //prefColors = ["#A6CEE3", "#1F78B4", "#B2DF8A", "#33A02C", "#FB9A99", "#E31A1C", 
      //  "#FDBF6F", "#FF7F00", "#CAB2D6", "#6A3D9A", "#FFFF99", "#B15928"];
      // Magma (12) color palette https://waldyrious.net/viridis-palette-generator/
      prefColors = ['#fcfdbf', '#fed395', '#fea973', '#fa7d5e', '#e95462', '#c83e73', '#a3307e', '#7e2482', '#59157e', '#331067', '#120d31', '#000004'];
    usedColors.each( function(color) {
      prefColors = prefColors.without(color);
    });
    if(prefColors.length > 0) {
      return prefColors[0];
    } else {
      var randomColor = Raphael.getColor();
      while(randomColor == '#ffffff' || usedColors.indexOf(randomColor) != -1) {
        randomColor = '#'+((1<<24)*Math.random()|0).toString(16);
      }
      return randomColor;
    }
  }
});

export default HPOLegend;
