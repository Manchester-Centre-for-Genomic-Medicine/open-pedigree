import Raphael from 'pedigree/raphael';
import Legend from 'pedigree/view/legend';
import Person from 'pedigree/view/person';
import Gene from 'pedigree/gene';

/**
 * Class responsible for keeping track of candidate genes.
 * This information is graphically displayed in a 'Legend' box.
 *
 * @class GeneLegend
 * @constructor
 */
var GeneLegend = Class.create( Legend, {

  initialize: function($super) {
    $super('Candidate Genes');
    // Save gene HGNC IDs. They are displayed in node menu, but not in the legend itself.
    // Used when legend is refreshed during coloring switch
    this._hgncIDs = {}
  },

  _getPrefix: function(id) {
    return 'gene';
  },

  /**
   * Save gene HGNC ID
   *
   * @method addHGNCID
   * @param {String} name Gene Symbol
   * @param {String} hgncID Gene HGNC ID
   */
  addHGNCID: function(name, hgncID) {
    this._hgncIDs[name] = hgncID;
  },

  /**
   * Get gene HGNC ID
   *
   * @method getHGNCID
   * @param {String} name Gene Symbol
   * @return {String} Gene HGNC ID
   */
  getHGNCID: function(name) {
    return this._hgncIDs[name];
  },
  
  /**
     * Generate the element that will display information about the given disorder in the legend
     *
     * @method _generateElement
     * @param {String} geneID The id for the gene
     * @param {String} name The human-readable gene description
     * @return {HTMLLIElement} List element to be insert in the legend
     */
  _generateElement: function($super, geneID, name) {
    if (!this._objectColors.hasOwnProperty(geneID) && this._showColors) {
      var color = this._generateColor(geneID);
      this._objectColors[geneID] = color;
      document.fire('gene:color', {'id' : geneID, color: color});
    }

    return $super(geneID, name);
  },

  /**
     * Generates a CSS color.
     * Has preference for some predefined colors that can be distinguished in gray-scale
     * and are distint from disorder colors.
     *
     * @method generateColor
     * @return {String} CSS color
     */
  _generateColor: function(geneID) {
    if(this._objectColors.hasOwnProperty(geneID)) {
      return this._objectColors[geneID];
    }

    var usedColors = Object.values(this._objectColors),
      // green palette
      // prefColors = ['#81a270', '#c4e8c4', '#56a270', '#b3b16f', '#4a775a', '#65caa3'];
      // Inferno (12) color palette https://waldyrious.net/viridis-palette-generator/
      prefColors = ['#fcffa4', '#f5db4c', '#fcae12', '#f78410', '#e65d2f', '#cb4149', '#a92e5e', '#85216b', '#5f136e', '#390963', '#140b34', '#000004'];
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

export default GeneLegend;
