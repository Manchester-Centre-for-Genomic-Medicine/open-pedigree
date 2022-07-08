import PedigreeEditor from './script/pedigree';

import '@fortawesome/fontawesome-free/js/fontawesome'
import '@fortawesome/fontawesome-free/js/solid'

import '../public/vendor/xwiki/xwiki-min.css';
import '../public/vendor/xwiki/fullScreen.css';
import '../public/vendor/xwiki/colibri.css';
import '../public/vendor/phenotips/Widgets.css';
import '../public/vendor/phenotips/DateTimePicker.css';
import '../public/vendor/phenotips/Skin.css';

var editor;

document.observe('dom:loaded',function() {
  editor = new PedigreeEditor({
    //patientDataUrl: '',
    //returnUrl: 'https://github.com/phenotips/open-pedigree',
    //tabs: ['Personal', 'Clinical'],
  });
});


document.observe('pedigree:person:set:hpo', function(event) {
  // Function to print Person external ID and HPO terms when the latter are updated.
  console.log('Person HPO Terms were updated!')
  console.log('Person external ID:', event.memo.node.getExternalID())
  console.log('HPO Terms:')
  var hpos = event.memo.value
  for(var i = 0; i < hpos.length; i++) {
    var hpo = hpos[i]
    console.log(`${i}) ID: ${hpo.getID()}, Name: ${hpo.getName()}`);
  }
});
