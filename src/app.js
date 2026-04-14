// --- Standalone Helper: Pedigree Data Validation ---
// Usage: Call validatePedigreeData(pedigreeData) before using pedigreeData in the editor.
// Returns true if valid, false and warns if missing ancestor/edge references.
export function validatePedigreeData(data) {
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
    if (typeof window !== 'undefined' && window.console && window.alert) {
      console.warn('Pedigree data has missing ancestor/edge references:', missing);
      alert('Warning: Pedigree data has missing ancestor/edge references. Some nodes may not display or function correctly. See console for details.');
    }
    return false;
  }
  return true;
}

const clearNodeDemographics = async function(node, clear_hpos) {
  node.setFirstName('');
  node.setLastName('');
  node.setPhenopacketID('');
  if(node.isNHSNumber(node.getExternalID())) {
    var nhsID = node.getExternalID().replaceAll(' ', '');
    var result = await getDemographicsGenO(nhsID);
    if (result.data?.individual[0]) {
      clearNodeDemographics(node, true);
      if (oldPhenopacketID !== result.data?.individual[0]?.phenopacket_id && !!oldPhenopacketID) {
        removeFromFamilyCohort(oldPhenopacketID, COHORT.cohort_id);
      }
      addToFamilyCohort(result.data.individual[0].id, COHORT.cohort_id);
      node.setFirstName(result.data?.individual[0]?.first_name);
      node.setLastName(result.data?.individual[0]?.last_name);
      node.setPhenopacketID(result.data?.individual[0]?.phenopacket_id);
      node.setLifeStatus(
        result.data?.individual[0]?.deceased ? 'deceased' : 'alive'
      );
      // Handle variants and comments
      var variants = [];
      result.data?.individual[0]?.phenopacket?.genomic_interpretations?.forEach?.(function(v) {
        if (v.display_text !== undefined 
            && (v.pathogenicity_text == 'Pathogenic' || v.pathogenicity_text == 'Likely pathogenic')
            && (v.report_category == 'Primary' || v.report_category == 'Primary finding')) {
          var text = v.display_text;
          text = text.replaceAll('Heterozygous', 'Het');
          text = text.replaceAll('Homozygous', 'Hom');
          text = text.replaceAll('Hemizygous', 'Hem');
          // Attempt to wrap variant text in a box with a line of no more than 30 symbols.
          var parts = text.split(' ');
          var formatted_text = '';
          var HGNC_GENES = [];
          var GEN_O_DISORDERS = [];
          var HPO_TERMS = [];
          // ... any additional logic for variants ...
          // Optionally push to variants array if needed
        }
      }); // End forEach
    }
  }
}

        document.observe('pedigree:person:set:hpo', async (event) => {
          var result = await updateExternalHPO(event.memo.node.getPhenopacketID(), event.memo.value);
        });

        const insertPhenopacket = async function () {
          const result = await graphql({ query: Queries.INSERT_PHENOPACKET });
          return result.data?.phenopacket?.id;
        }

        const insertInterpretation = async function (phenopacketID) {
          const variables = {
            phenopacket_id: phenopacketID,
            specialty_id: specialtyID
          };
          const result = await graphql({ query: Queries.INSERT_INTERPRETATION, variables });
          return result.data?.interpretation?.id;
        }

        const insertCaseHistory = async function (phenopacketID, status="Referred", notes="Added via Open Pedigree") {
          var variables = {
            status: status
          }
          var result = await graphql({ query: Queries.GET_CASE_STATUS, variables });
          var case_status_id = result.data?.case_status[0]?.id;
          variables = {
            phenopacket_id: phenopacketID,
            case_status_id: case_status_id,
            notes: notes
          };
          result = await graphql({ query: Queries.ADD_CASE_STATUS, variables });
          return result.data?.case_history?.id;
        }

        const upsertIndividual = async function (node) {
          const variables = {
            primary_identifier: node.getExternalID(true),
            phenopacket_id: node.getPhenopacketID(),
            first_name: node.getFirstName(),
            last_name: node.getLastName(),
            deceased: node.getLifeStatus() == 'deceased' ? true : false,
            date_of_birth: node.getBirthDate() ? node.getBirthDate().toISO8601().split('T')[0] : null,
            date_of_death: node.getDeathDate() ? node.getDeathDate().toISO8601().split('T')[0] : null,
            sex: node.getGender(true)
          }
          const result = await graphql({ query: Queries.UPSERT_INDIVIDUAL, variables });
          return result.data?.individual?.id;
        }

        document.observe('pedigree:person:createGenO', async function(event) {
          var node = event.memo.node;
          if(event.memo.node.isNHSNumber(event.memo.node.getExternalID())) {
            var phenopacketID = await insertPhenopacket();
            node.setPhenopacketID(phenopacketID);
            var individualID = await upsertIndividual(node);
            var interpretationID = await insertInterpretation(phenopacketID);
            var caseStetusID = await insertCaseHistory(phenopacketID);
            var hpoResult = await updateExternalHPO(phenopacketID, node.getHPO());
            var cohortId = await addToFamilyCohort(individualID, COHORT.cohort_id);
            if (phenopacketID && individualID && interpretationID && caseStetusID && cohortId) {
              console.log('Gen-O patient record was successfully created');
            } else {
              console.error('Failed to create Gen-O record patient record.');
              console.log('phenopacketID:', phenopacketID);
              console.log('individualID:', individualID);
              console.log('interpretationID:', interpretationID);
              console.log('caseStetusID:', caseStetusID);
              console.log('cohort id', cohortId);
            }
            disableGenOButtons(true, false, false, true);
          } else {
            alert(`The extrnal ID '${event.memo.node.getExternalID()}' is not a 10-digit NHS number written as XXXXXXXXXX or XXX XXX XXXX.`);
          }
        });

        document.observe('pedigree:person:updateGenO', async function(event) {
          var nhsID = event.memo.node.getExternalID(true);
          var result = await getDemographicsGenO(nhsID);
          var changedFields = [];
          if (result.data?.individual[0]?.first_name != event.memo.node.getFirstName()) {
            changedFields.push([
              'First name',
              result.data?.individual[0]?.first_name,
              event.memo.node.getFirstName()
            ]);
          }
          if (result.data?.individual[0]?.last_name != event.memo.node.getLastName()) {
            changedFields.push([
              'Last name',
              result.data?.individual[0]?.last_name,
              event.memo.node.getLastName()
            ]);
          }
          if (result.data?.individual[0]?.deceased != event.memo.node.getLifeStatus() == 'deceased') {
            changedFields.push([
              'Life status',
              result.data?.individual[0]?.deceased ? 'deceased' : 'alive',
              event.memo.node.getLifeStatus()
            ]);
          }
          if (event.memo.node.getBirthDate()) {
            var newBirthDate = event.memo.node.getBirthDate().toISO8601().split('T')[0];
          } else {
            var newBirthDate = null;
          }
          if (result.data?.individual[0]?.date_of_birth != newBirthDate) {
            changedFields.push([
              'Date of birth',
              result.data?.individual[0]?.date_of_birth,
              newBirthDate
            ]);
          }
          if (event.memo.node.getDeathDate()) {
            var newDeathDate = event.memo.node.getDeathDate().toISO8601().split('T')[0];
          } else {
            var newDeathDate = null;
          }
          if (result.data?.individual[0]?.date_of_death != newDeathDate) {
            changedFields.push([
              'Date of death',
              result.data?.individual[0]?.date_of_death,
              newDeathDate
            ]);
          }
          if (result.data?.individual[0]?.sex != event.memo.node.getGender(true)) {
            changedFields.push([
              'Gender',
              result.data?.individual[0]?.sex,
              event.memo.node.getGender(true)
            ]);
          }

          if (changedFields.length == 0) {
            alert("Nothing to update, the patient's demographics data in Gen-O is the same.");
          } else {
            var updateSummary = `You are going to submit the following changes of the patient's (NHS number: ${nhsID}) demographics data into Gen-O:\n`;
            changedFields.forEach(function (changedField) {
              updateSummary += `${changedField[0]}: ${changedField[1]} -> ${changedField[2]}\n`;
            });
            updateSummary += `Note that any changes of the HPO terms are synchronised automatically (and consequently not listed here),`;
            updateSummary += ` whereas associated disorders and genes are currently not saved in Gen-O.\n`;
            updateSummary += `Please press OK to confirm the changes.`;
            let confirmAction = confirm(updateSummary);
            if (confirmAction) {
              upsertIndividual(event.memo.node);
              alert("Gen-O patient demographics data was updated.");
            } else {
              alert("Gen-O patient demographics data was not updated.");
            }
          }
        });

        document.observe('pedigree:person:viewGenO', function(event) {
          window.open(`${gen_o_application_uri}/patients/${event.memo.node.getPhenopacketID()}`, '_blank').focus();
        });

        document.observe('pedigree:node:refresh-gen-o-buttons-status', function(event) {
          if (event.memo.node.getType() == 'Person') {
            if(event.memo.node.isNHSNumber(event.memo.node.getExternalID())) {
              if (event.memo.node.getPhenopacketID()) {
                disableGenOButtons(true, false, false, true);
              } else {
                disableGenOButtons(false, true, true, true);
              }
            } else {
              disableGenOButtons(true, true, true, true);
            }
          }
        });

        document.observe('pedigree:load:finish', function() {
          // This function synchronizes nodes properties with external resources (Gen-O and NHS PDS)
          // based on NHS IDs when they are loaded.
          for (const [elementID, element] of Object.entries(editor.getView().getNodeMap())) {
            if (element.getType() == 'Person') {
              updateNodeOnExternalIDChange(element);
            }
          }
        });

            // --- Handlers outside dom:loaded ---
            document.observe('pedigree:person:set:disorders', function(event) {
              // Function to print Person external ID and disorder terms when the latter are updated.
              console.log('Person disorders were updated!')
              console.log('Person external ID:', event.memo.node.getExternalID())
              console.log('Disorders:')
              var disorders = event.memo.value
              for(var i = 0; i < disorders.length; i++) {
                var disorder = disorders[i]
                var disorderID = disorder.getDesanitizedDisorderID();
                if (disorderID) {
                  console.log(`${i}) ID: ${disorderID}, Name: ${disorder.getName()}`);
                } else {
                  console.log(`${i}) ID: null, Name: ${disorder.getName()}`);
                }
              }
            });

            document.observe('pedigree:person:set:hpo', function(event) {
              // Function to print Person external ID and HPO terms when the latter are updated.
              console.log('Person HPO Terms were updated!');
              console.log('Person external ID:', event.memo.node.getExternalID());
              console.log('HPO Terms:');
              var hpos = event.memo.value;
              for(var i = 0; i < hpos.length; i++) {
                var hpo = hpos[i];
                var hpoID = hpo.getID();
                if (hpoID) {
                  console.log(`${i}) ID: ${HPOTerm.desanitizeID(hpoID)}, Name: ${hpo.getName()}`);
                } else {
                  console.log(`${i}) ID: null, Name: ${hpo.getName()}`);
                }
              }
            });

            document.observe('pedigree:person:set:genes', function(event) {
              // Function to print Person external ID and genes when the latter are updated.
              console.log('Person genes were updated!');
              console.log('Person external ID:', event.memo.node.getExternalID());
              console.log('Genes:');
              var genes = event.memo.value;
              for(var i = 0; i < genes.length; i++) {
                var gene = genes[i];
                var geneID = gene.getID();
                if (geneID) {
                  console.log(`${i}) ID: ${geneID}, Name: ${gene.getSymbol()}`);
                } else {
                  console.log(`${i}) ID: null, Name: ${gene.getSymbol()}`);
                }
              }
            });


// --- Custom selectize handlers at top level ---
document.observe('custom:selectize:load:genes', async function(event) {
  // Function to populate selecitzeJS control with HGNC genes from Gen-O.
  HGNC_GENES.forEach(function(item) {
    if (item.hgnc_id && item.symbol) {
      var gene = new Gene(item.hgnc_id, item.symbol, item.locus_group);
      item = {
        id: gene.getID(),
        name: gene.getSymbol(),
        value: gene.getDisplayName(),
        group: gene.getGroup(),
      };
      event.memo.addOption(item);
    }
  });
  event.memo.refreshOptions();
});

document.observe('custom:selectize:load:disorders', async function(event) {
  // Function to populate selecitzeJS control with ORPHA and ICD-10 genes from Gen-O.
  GEN_O_DISORDERS.forEach(function(item) {
    if (item.ontology_id && item.name) {
      var disorder = new Disorder(item.ontology_id, item.name);
      item = {
        id: disorder.getDesanitizedDisorderID(),
        name: disorder.getName(),
        value: disorder.getDisplayName(),
      };
      event.memo.addOption(item);
    }
  });
  event.memo.refreshOptions();
});

document.observe('custom:selectize:load:hpos', async function(event) {
  // Function to populate selecitzeJS control with HPO terms from Gen-O.
  HPO_TERMS.forEach(function(item) {
    if (item.id && item.name) {
      var hpo = new HPOTerm(item.id, item.name);
      item = {
        id: hpo.getDesanitizedID(),
        name: hpo.getName(),
        value: hpo.getDisplayName()
      };
      event.memo.addOption(item);
    }
  });
  event.memo.refreshOptions();
});