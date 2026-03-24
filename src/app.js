import PedigreeEditor from './script/pedigree';

import '@fortawesome/fontawesome-free/js/fontawesome'
import '@fortawesome/fontawesome-free/js/solid'

import '../public/vendor/xwiki/xwiki-min.css';
import '../public/vendor/xwiki/fullScreen.css';
import '../public/vendor/xwiki/colibri.css';
import '../public/vendor/phenotips/Widgets.css';
import '../public/vendor/phenotips/DateTimePicker.css';
import '../public/vendor/phenotips/Skin.css';

// For some reason this import doesn't work, so it is loaded in index.html.
//import '../public/vendor/selectize/selectize.default.css';

import HPOTerm from 'pedigree/hpoTerm';

var editor;

document.observe('dom:loaded',function() {
  // Utility: Validate pedigree data for missing ancestor references
  function validatePedigreeData(data) {
    if (!data || !Array.isArray(data.GG)) return true;
    const nodeIds = new Set(data.GG.map(n => n.id));
    let missing = [];
    data.GG.forEach(node => {
      if (Array.isArray(node.outedges)) {
        node.outedges.forEach(edge => {
          if (edge && typeof edge.to === 'number' && !nodeIds.has(edge.to)) {
            missing.push({from: node.id, to: edge.to});
          }
        });
      }
    });
    if (missing.length > 0) {
      console.warn('Pedigree data has missing ancestor/edge references:', missing);
      alert('Warning: Pedigree data has missing ancestor/edge references. Some nodes may not display or function correctly. See console for details.');
      return false;
    }
    return true;
  }

  // Example: If you load pedigree data from somewhere, validate it first
  // Replace this with your actual data loading logic
  // let pedigreeData = ...
  // if (validatePedigreeData(pedigreeData)) {
  //   editor = new PedigreeEditor({ ... });
  // }

  editor = new PedigreeEditor({
    //patientDataUrl: '',
    //returnUrl: 'https://github.com/phenotips/open-pedigree',
    //tabs: ['Personal', 'Clinical'],
  });
});


document.observe('pedigree:person:set:hpo', function(event) {
  // Function to print Person external ID and HPO terms when the latter are updated.
  console.log('Person HPO Terms were updated!');
  console.log('Person external ID:', event.memo.node.getExternalID());
  console.log('HPO Terms:');
  var hpos = event.memo.value;
  for(var i = 0; i < hpos.length; i++) {
    var hpo = hpos[i];
    console.log(`${i}) ID: ${HPOTerm.desanitizeID(hpo.getID())}, Name: ${hpo.getName()}`);
  }
});

// Defensive patch: ensure setComments is not called with null/undefined
// Example usage: node.setComments(someString)
// If you have code like node.setComments(variants.join('\r\n') + '\r\n' + node.getComments()), patch as below:
function safeSetComments(node, newComments) {
  var existingComments = node.getComments();
  if (typeof existingComments !== 'string') existingComments = '';
  node.setComments(newComments + (existingComments ? ('\r\n' + existingComments) : ''));
}

document.observe('pedigree:person:set:genes', function(event) {
  // Function to print Person external ID and genes when the latter are updated.
  console.log('Person genes were updated!');
  console.log('Person external ID:', event.memo.node.getExternalID());
  console.log('Genes:');
  var genes = event.memo.value;
  for(var i = 0; i < genes.length; i++) {
    var gene = genes[i];
    console.log(`${i}) ID: ${gene.getID()}, Name: ${gene.getSymbol()}`);
  }
});
