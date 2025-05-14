import PDFDocument from 'vendor/pdfkit/pdfkit.standalone';
import SVGtoPDF from 'vendor/pdfkit/svg-to-pdfkit';
import blobStream from 'vendor/pdfkit/blob-stream';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';

var PedigreeExport = function () {
};

PedigreeExport.prototype = {
};

//===============================================================================================

/*
 *  PED format:
 *  (from http://pngu.mgh.harvard.edu/~purcell/plink/data.shtml#ped)
 *   Family ID
 *   Individual ID
 *   Paternal ID
 *   Maternal ID
 *   Sex (1=male; 2=female; other=unknown)
 *   Phenotype
 *
 *   Phenotype, by default, should be coded as:
 *      -9 missing
 *       0 missing
 *       1 unaffected
 *       2 affected
 */
PedigreeExport.exportAsPED = function(pedigree, idGenerationPreference) {
  const DELIMITER = '';
  var output = '';

  var familyID = 'OPENPED';

  var idToPedId = PedigreeExport.createNewIDs(pedigree, idGenerationPreference);

  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }

    output += familyID + ' ' + idToPedId[i] + ' ';

    // mother & father
    var parents = pedigree.GG.getParents(i);
    if (parents.length > 0) {
      var father = parents[0];
      var mother = parents[1];

      if ( pedigree.GG.properties[parents[0]]['gender'] == 'F' ||
                pedigree.GG.properties[parents[1]]['gender'] == 'M' ) {
        father = parents[1];
        mother = parents[0];
      }
      output += idToPedId[father] + ' ' + idToPedId[mother] + ' ';
    } else {
      output += '0 0 ';
    }

    var sex = 3;
    if (pedigree.GG.properties[i]['gender'] == 'M') {
      sex = 1;
    } else if (pedigree.GG.properties[i]['gender'] == 'F') {
      sex = 2;
    }
    output += (sex + ' ');

    var status = -9; //missing
    if (pedigree.GG.properties[i].hasOwnProperty('carrierStatus')) {
      if (pedigree.GG.properties[i]['carrierStatus'] == 'affected' ||
               pedigree.GG.properties[i]['carrierStatus'] == 'carrier'  ||
               pedigree.GG.properties[i]['carrierStatus'] == 'presymptomatic') {
        status = 2;
      } else {
        status = 1;
      }
    }
    output += status + '\n';
  }

  return output;
};

function getAge(dateOfBirth) {
  const today = new Date(); // Get the current date
  let age = today.getFullYear() - dateOfBirth.getFullYear(); // Calculate the year difference

  // Adjust the age if the birthday hasn't occurred yet this year
  const hasHadBirthdayThisYear =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() && today.getDate() >= dateOfBirth.getDate());

  if (!hasHadBirthdayThisYear) {
    age--;
  }

  return age;
}

/**
 * Get the twin group number for an individual.
 * 
 * @param {Object} individual - The individual object containing twin group information.
 * @returns {number|string} - The twin group number (0-9 or 'A') or 0 if not a twin.
 * @throws {Error} - Throws an error if the twin group number is invalid.
 */
function getTwinGroup(individual) {
  if (individual.hasOwnProperty('monozygotic') && individual['monozygotic'] === true) {
    if (!individual.hasOwnProperty('twinGroup')) {
      console.warn('Twin group number is missing, setting to 0');
      return 0;
    }

    // CanRisk uses 1-indexing up to 9, then 'A' to represent 10
    if (individual['twinGroup'] <= 8) {
      return individual['twinGroup'] + 1;
    } else if (individual['twinGroup'] === 9) {
      return 'A';
    } else {
      throw new Error('Too many twin groups for CanRisk support');
    }
  }

  return 0;
}

/**
 * Canrisk format
 * Details: https://canrisk.atlassian.net/wiki/spaces/FAQS/pages/2456616961/CanRisk+Pedigree+Data+v3+File+Format+Specification
 * 
 * CanRisk format is similar to PED format, but with the following differences:
 * 
 */

PedigreeExport.exportAsCanrisk = function(pedigree, idGenerationPreference) {
  const generateDataLine = (values) => values.join('\t');
  const generateHeader = (values) => values
      .map(val => `##${val}`)
      .join('\n') + '\n';
  const HEADER = generateHeader([
    'CanRisk 3.0',
    generateDataLine([
      'FamID',
      'Name',
      'Target',
      'IndivID',
      'FathID',
      'MothID',
      'Sex',
      'MZtwin',
      'Dead',
      'Age',
      'Yob',
      'BC1',
      'BC2',
      'OC',
      'PRO',
      'PAN',
      'Ashkn',
      'BRCA1',
      'BRCA2',
      'PALB2',
      'ATM',
      'CHEK2',
      'BARD1',
      'RAD51D',
      'RAD51C',
      'BRIP1',
      'ER:PR:HER2:CK14:CK56'
    ])
  ]);
  var familyID = 'OPENPED';

  const generateLine = (individual) => {
    return generateDataLine([
      individual.familyId ?? 'OPENPED',
      (individual.name && individual.name.length > 0)
        ? individual.name
        : 'Unknown',
      individual.target ?? 0,
      individual.id,
      individual.father ?? 0,
      individual.mother ?? 0,
      individual.sex ?? 'F',
      individual.mzTwin ?? 0,
      individual.dead ?? 0,
      individual.age ?? 0,
      individual.yob ?? 0,
      individual.bc1 ?? 0,
      individual.bc2 ?? 0,
      individual.oc ?? 0,
      individual.pro ?? 0,
      individual.pan ?? 0,
      individual.ashkn ?? 0,
      individual.brca1 ?? '0:0',
      individual.brca2 ?? '0:0',
      individual.palb2 ?? '0:0',
      individual.atm ?? '0:0',
      individual.chek2 ?? '0:0',
      individual.bard1 ?? '0:0',
      individual.rad51d ?? '0:0',
      individual.rad51c ?? '0:0',
      individual.brip1 ?? '0:0',
      individual.estrogen ?? '0:0:0:0:0'
    ]) + '\n';
  }
  var output = HEADER;

  var idToPedId = PedigreeExport.createNewIDs(pedigree, idGenerationPreference);

  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }

    let individual = {
      id: idToPedId[i],
      familyId: familyID,
      name: [
        pedigree.GG.properties[i]['fName'],
        pedigree.GG.properties[i]['lName'],
      ].filter(val => !!val)
        .join('')
        .substring(0, 7),
    };

    // mother & father
    var parents = pedigree.GG.getParents(i);
    if (parents.length > 0) {
      const fatherIsLeftParent = pedigree.GG.properties[parents[0]]['gender'] == 'M'
        || pedigree.GG.properties[parents[1]]['gender'] == 'F';

      const father = fatherIsLeftParent ? parents[0] : parents[1];
      const mother = fatherIsLeftParent ? parents[1] : parents[0];

      individual.father = idToPedId[father];
      individual.mother = idToPedId[mother];
    }

    if (pedigree.GG.properties[i]['gender'] == 'M') {
      individual.sex = 'M';
    } else if (pedigree.GG.properties[i]['gender'] == 'F') {
      individual.sex = 'F';
    }

    if (pedigree.GG.properties[i]['monozygotic'] === true) {
      individual.mzTwin = getTwinGroup(pedigree.GG.properties[i]);
    }

    const dob = pedigree.GG.properties[i]['dob'];
    const dobData = new Date(pedigree.GG.properties[i]['dob']);
    individual.dead = pedigree.GG.properties[i]['lifeStatus'] == 'deceased' ? 1 : 0;
    individual.age = dob
      ? getAge(dobData)
      : 0;
    individual.yob = dob
      ? dobData.getFullYear()
      : 0;
    
    output += generateLine(individual);
  }

  return output;
};

/* ===============================================================================================
 *
 * Creates and returns a JSON in the "GA4GH FHIR JSON" format
 *
 * ===============================================================================================
 */

PedigreeExport.exportAsGA4GH = function(pedigree, privacySetting = "all", fhirPatientReference = null,
  pedigreeImage = null){
  return GA4GHFHIRConverter.exportAsFHIR(pedigree, privacySetting, fhirPatientReference, pedigreeImage);
};

// ===============================================================================================

PedigreeExport.exportAsSVG = function(pedigree, privacySetting = 'all') {
  var image = $('canvas');
  var background = image.getElementsByClassName('panning-background')[0];
  var backgroundPosition = background.nextSibling;
  var backgroundParent = background.parentNode;
  backgroundParent.removeChild(background);
  var bbox = image.down().getBBox();
  var pedigreeImage = image.innerHTML
    .replace(/xmlns:xlink=".*?"/, '')
    .replace(/width=".*?"/, '')
    .replace(/height=".*?"/, '')
    .replace(/viewBox=".*?"/, 'viewBox="' + bbox.x + ' ' + bbox.y + ' ' + bbox.width + ' ' + bbox.height + '" width="' + bbox.width + '" height="' + bbox.height + '" xmlns:xlink="http://www.w3.org/1999/xlink"');
  var context = window.location.href.replace(/&/g, '&amp;');
  pedigreeImage = pedigreeImage.split(context).join('');

  backgroundParent.insertBefore(background, backgroundPosition);

  const parser = new DOMParser();
  const dom = parser.parseFromString(pedigreeImage, 'application/xml');

  function removeHiddenNodes(domNode) {
    let toRemove = [];
    for (let childNode of domNode.childNodes) {
      if (childNode.style && 'none' === childNode.style.display){
        toRemove.push(childNode);
      }
      else if (childNode.style && '0' == childNode.style.opacity && '0' == childNode.style.fillOpacity){
        toRemove.push(childNode);
      }
      else {
        removeHiddenNodes(childNode);
      }
    }
    for (let childNode of toRemove){
      domNode.removeChild(childNode);
    }
  }
  function removeText(dom, fontSize) {
    let toRemove = [];
    for (let textNode of dom.getElementsByTagName('text')){
      if (textNode.style.fontSize === fontSize){
        toRemove.push(textNode);
      }
    }
    for (let childNode of toRemove){
      childNode.parentNode.removeChild(childNode);
    }
  }

  removeHiddenNodes(dom.getRootNode());
  if (privacySetting !== 'all' ){
    removeText(dom, '20px');
  }
  if (privacySetting === 'minimal'){
    removeText(dom, '19px');
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(dom);
}



PedigreeExport.exportAsPDF = function(pedigree, privacySetting = 'all', pageSize = 'A4', layout = 'landscape', legendPos = 'TopRight'){
  var pedigreeImage = PedigreeExport.exportAsSVG(pedigree, privacySetting);

  let legend = [];
  let itemCount = 0;
  let container = document.getElementById('legend-container');
  let rgbRegex =/^rgb\(([0-9]+), ?([0-9]+), ?([0-9]+)\)$/;
  for (let c of container.childNodes){
    if (c.tagName !== 'DIV'){
      continue;
    }
    if (c.style && c.style.display === 'none'){
      continue;
    }

    let h2Array = c.getElementsByTagName('H2');
    let legendSection = {
      heading: '',
      items: []
    };
    legend.push(legendSection);
    let colour = null;
    let name = null;
    let cases = null;

    if (h2Array){
      legendSection.heading = h2Array[0].textContent;
    }
    for (let li of c.getElementsByTagName('li')){
      let colourArray = li.getElementsByClassName('disorder-color');
      if (colourArray){
        colour = colourArray[0].style.backgroundColor;
        if (colour.startsWith('#')){
          // already hex
        } else if (colour.startsWith('rgb(')){
          // rgb
          let colourSplit = rgbRegex.exec(colour);
          if (colourSplit != null){
            colour = '#' + parseInt(colourSplit[1]).toString(16) + parseInt(colourSplit[2]).toString(16) + parseInt(colourSplit[3]).toString(16);
          }
        }
      }
      let nameArray = li.getElementsByClassName('disorder-name');
      if (nameArray){
        name = nameArray[0].textContent;
      }
      let casesArray = li.getElementsByClassName('disorder-cases');
      if (casesArray){
        cases = casesArray[0].textContent;
      }

      legendSection.items.push({colour: colour, name: name, cases: cases});
      itemCount++;
    }
  }


  let compress = false;
  let doc = new PDFDocument({compress: compress, size: pageSize, layout: layout});

  let stream = doc.pipe(blobStream());
  stream.on('finish', function () {
    let blob = stream.toBlob('application/pdf');
    //   // new FileSaver(blob, 'open-pedigree.pdf');
    //   navigator.msSaveOrOpenBlob(blob, 'open-pedigree.pdf');
    saveAs(blob, 'open-pedigree.pdf');
    //   // if (navigator.msSaveOrOpenBlob) {
    //   //   navigator.msSaveOrOpenBlob(blob, 'open-pedigree.pdf');
    //   // } else {
    //   //   alert("Don't know how to save to pdf in ie9")
    //   //   console.log("Don't know how to save in ie9");
    //   // }
  });
  let headingCount = legend.length;

  // work out max width for text
  let maxWidth = 0;
  doc.save();
  for (let cat of legend){
    doc.fontSize(14);
    const hw = doc.widthOfString(cat.heading);
    if (hw > maxWidth){
      maxWidth = hw;
    }
    for (let item of cat.items) {
      doc.fontSize(10);
      const w = doc.widthOfString(item.name + ' (' + item.cases + ')');
      if (w > maxWidth) {
        maxWidth = w;
      }
    }
  }
  doc.restore();

  let lineOffset = 14;
  let catOffset = 2;
  let legendHeight = (lineOffset * (headingCount+itemCount)) + (headingCount*catOffset) + 10;
  let xOffset = 5;
  let yOffset = doc.page.height - legendHeight;
  let pedigreeXOffset = 5;
  let pedigreeYOffset = legendHeight;
  let pedigreeWidth = doc.page.width - 10;
  let pedigreeHeight = Math.max(doc.page.height - legendHeight, doc.page.height * 0.6);

  if (legendPos === 'TopLeft') {
    // easy one.
    xOffset = 5;
    yOffset = 5;
    pedigreeYOffset = legendHeight;
  } else if (legendPos === 'BottomLeft') {
    xOffset = 5;
    yOffset = doc.page.height - legendHeight;
    pedigreeYOffset = 5;
  } else if (legendPos === 'BottomRight') {
    xOffset = doc.page.width - (20 + maxWidth) ;
    yOffset = doc.page.height - legendHeight;
    pedigreeYOffset = 5;
  } else {
    // 'TopRight' default
    xOffset = doc.page.width - (20 + maxWidth) ;
    yOffset = 5;
    pedigreeYOffset = legendHeight;
  }


  for (let cat of legend){
    doc.save();
    doc.fontSize(14);
    doc.text(cat.heading, xOffset, yOffset, {lineBreak: false});
    yOffset += lineOffset;
    for (let item of cat.items){
      // console.log(item);
      doc.save();
      doc.rect(xOffset, yOffset, 8, 8).fill(item.colour, 1);
      doc.restore();
      doc.fontSize(10);
      doc.text(item.name + ' (' + item.cases + ')', xOffset + 10, yOffset, {lineBreak: false});
      yOffset += lineOffset;
    }
    yOffset += catOffset;
    doc.restore();
  }

  let options = {
    warningCallback: (str)=>console.error(str),
    useCSS: false,
    assumePt: false,
    preserveAspectRatio: 'xMidYMid meet',
    // use at least 60% of height for image, this may overwrite the legend.
    height: pedigreeHeight,
    width: pedigreeWidth
  };

  SVGtoPDF(doc, pedigreeImage, pedigreeXOffset, pedigreeYOffset, options);
  doc.end();
  // doc.write('open-pedigree.pdf');
  return doc;
};


// ===============================================================================================

// TODO: convert internal properties to match public names and rename this to "supportedProperties"
PedigreeExport.internalToJSONPropertyMapping = {
  'proband':       'proband',
  'fName':         'firstName',
  'lName':         'lastName',
  'comments':      'comments',
  'twinGroup':     'twinGroup',
  'monozygotic':   'monozygotic',
  'isAdopted':     'adoptedIn',
  'evaluated':     'evaluated',
  'dob':           'birthDate',
  'dod':           'deathDate',
  'gestationAge':  'gestationAge',
  'lifeStatus':    'lifeStatus',
  'disorders':     'disorders',
  'ethnicities':   'ethnicities',
  'carrierStatus': 'carrierStatus',
  'externalID':    'externalId',
  'gender':        'sex',
  'numPersons':    'numPersons',
  'hpoTerms':      'hpoTerms',
  'candidateGenes':'candidateGenes',
  'lostContact':   'lostContact'
};

/*
 * Converts property name from external JSON format to internal - also helps to
 * support aliases for some terms and weed out unsupported terms.
 */
PedigreeExport.convertProperty = function(internalPropertyName, value) {

  if (!PedigreeExport.internalToJSONPropertyMapping.hasOwnProperty(internalPropertyName)) {
    return null;
  }

  var externalPropertyName = PedigreeExport.internalToJSONPropertyMapping[internalPropertyName];

  if (externalPropertyName == 'sex') {
    if (value == 'M') {
      value = 'male';
    } else if (value == 'F') {
      value = 'female';
    } else {
      value = 'unknown';
    }
  }

  return {'propertyName': externalPropertyName, 'value': value };
};

PedigreeExport.createNewIDs = function(pedigree, idGenerationPreference, maxLength) {
  var idToNewId = {};
  var usedIDs   = {};
  const DELIMITER = '';

  var nextUnusedID = 1;

  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }
    console.log(pedigree.GG.properties[i]);

    var id = nextUnusedID++;
    if (idGenerationPreference == 'external' && pedigree.GG.properties[i].hasOwnProperty('externalID')) {
      nextUnusedID--;
      id = pedigree.GG.properties[i]['externalID'].replace(/\s/g, DELIMITER);
    } else if (idGenerationPreference == 'name' && pedigree.GG.properties[i].hasOwnProperty('fName')) {
      nextUnusedID--;
      id = pedigree.GG.properties[i]['fName'].replace(/\s/g, DELIMITER);
    }
    if (maxLength && id.length > maxLength) {
      id = id.substring(0, maxLength);
    }
    while ( usedIDs.hasOwnProperty(id) ) {
      if (!maxLength || id.length < maxLength) {
        id = DELIMITER + id;
      } else {
        id = nextUnusedID++;
      }
    }

    idToNewId[i] = id;
    usedIDs[id]  = true;
  }

  return idToNewId;
};

export default PedigreeExport;
