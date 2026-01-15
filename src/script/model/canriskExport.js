function createNewIDs(pedigree, idGenerationPreference, maxLength) {
  var idToNewId = {};
  var usedIDs   = {};
  const DELIMITER = '';

  var nextUnusedID = 1;

  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }
    // Removed unnecessary console.log statement.

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
}

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

export function exportAsCanrisk(pedigree, idGenerationPreference) {
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

  var idToPedId = createNewIDs(pedigree, idGenerationPreference);

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
    
    const numPersons = parseInt(pedigree.GG.properties[i]['numPersons']) || 1;
    for (let j = 0; j < numPersons; j++) {
      let clonedIndividual = { ...individual };
      if (numPersons > 1) {
        clonedIndividual.id = individual.id + '_' + (j + 1);
      }
      output += generateLine(clonedIndividual);
    }
  }

  return output;
}