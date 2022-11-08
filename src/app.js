import  { Auth0Client } from "@auth0/auth0-spa-js";

import PedigreeEditor from './script/pedigree';
import "babel-polyfill";
import Gene from 'pedigree/gene';

import '@fortawesome/fontawesome-free/js/fontawesome'
import '@fortawesome/fontawesome-free/js/solid'

import '../public/vendor/xwiki/xwiki-min.css';
import '../public/vendor/xwiki/fullScreen.css';
import '../public/vendor/xwiki/colibri.css';
import '../public/vendor/phenotips/Widgets.css';
import '../public/vendor/phenotips/DateTimePicker.css';
import '../public/vendor/phenotips/Skin.css';

import HPOTerm from 'pedigree/hpoTerm';
import Disorder from 'pedigree/disorder';

// Global variable, obtained from URL parameters when opened from Gen-O.
var specialtyID = null;
// IMPORTANT! Don't forget to change to false before commiting to github!
var DEV_MODE = false;

var HGNC_GENES = [];
var GEN_O_DISORDERS = [];
var HPO_TERMS = [];

// Expected to be LIVE, TEST, or DEVELOP. Anything else is considered DEVELOP
const GEN_O_VERSION = 'DEVELOP';

if (GEN_O_VERSION === 'LIVE') {
  var gen_o_domain = "gen-o.eu.auth0.com";
  var gen_o_client_id = "cMDwFfxF4hC1GOs6W35HdDSPmregh6A7";
  var gen_o_audience = "https://gen-o.eu.auth0.com/api/v2/";
  var gen_o_graphql = "https://graphql.northwestglh.com/v1/graphql";
  var gen_o_application_uri = "https://gen-o.northwestglh.com";
} else if (GEN_O_VERSION === 'TEST') {
  var gen_o_domain = "gen-o-test.eu.auth0.com";
  var gen_o_client_id = "Kx350GeJFnWb1mYc5H3GjMvG8hrc2OYR";
  var gen_o_audience = "https://gen-o-test.eu.auth0.com/api/v2/";
  var gen_o_graphql = "https://test-graphql.northwestglh.com/v1/graphql";
  var gen_o_application_uri = "https://test-gen-o.northwestglh.com";
} else if (GEN_O_VERSION === 'DEVELOP') {
  var gen_o_domain = "gen-o-dev.eu.auth0.com";
  var gen_o_client_id = "d3YJUQgU53bhu4O7nhPtFnXM4LjNUb6U";
  var gen_o_audience = "https://gen-o-dev.eu.auth0.com/api/v2/";
  var gen_o_graphql = "https://develop-graphql.northwestglh.com/v1/graphql";
  var gen_o_application_uri = "https://develop-gen-o.northwestglh.com";
} else {
  var gen_o_domain = "gen-o-dev.eu.auth0.com";
  var gen_o_client_id = "d3YJUQgU53bhu4O7nhPtFnXM4LjNUb6U";
  var gen_o_audience = "https://gen-o-dev.eu.auth0.com/api/v2/";
  var gen_o_graphql = "http://localhost:4100/v1/graphql";
  var gen_o_application_uri = "http://localhost:3000";
}

document.observe('dom:loaded', async function () {
  let auth0 = null;
  const configureAuth0 = async () => {
    auth0 = await new Auth0Client({
      domain: gen_o_domain,
      client_id: gen_o_client_id,
      audience: gen_o_audience,
    });
  };

  await configureAuth0();

  const authenticated = await auth0.isAuthenticated();
  const login = async () => {
    await auth0.loginWithRedirect({
      redirect_uri: window.location.href
    });
  };

  if (!authenticated) {
    const query = new URLSearchParams(window.location.search);
    if (query.has('code') && query.has('state')) {
      await auth0.handleRedirectCallback();
    } else {
      login();
    }
  }

  const graphql = async (body) => {
    const token = await auth0.getTokenSilently();
    const result = await fetch(gen_o_graphql, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body)
    }).then(r => r.json());

    return result;
  };
  
  const getGenes = async function () {
    const query = `
      query GetGene {
        gene(where: {source: {_eq: "HGNC"}}) {
          symbol
          hgnc_id
        }
      }
    `;
    const result = await graphql({ query });
    return result.data?.gene
  }

  const getDisorders = async function () {
    const query = `
      query GetDisorderApi {
        disorder_api {
          ontology_id
          name
        }
      }
    `;
    const result = await graphql({ query });
    return result.data?.disorder_api
  }

  const getHPOs = async function () {
    const query = `
      query GetHpoApi {
        hpo {
          id
          name
        }
      }
    `;
    const result = await graphql({ query });
    return result.data?.hpo
  }

  HGNC_GENES = await getGenes();
  GEN_O_DISORDERS = await getDisorders();
  HPO_TERMS = await getHPOs();

  const urlParams = new URLSearchParams(window.location.search);

  const editor = new PedigreeEditor({
    returnUrl: 'javascript:history.go(-2)',
    autosave: true,
    backend: {
      load: async ({ onSuccess, onError }) => {
        if (urlParams.has('specialty_id')) {
          specialtyID = urlParams.get('specialty_id');
        } else {
          console.warn('No specialty ID has been specified. Individuals created in open-pedigree will not be viewable in Gen-O.');
        }
        if (DEV_MODE) {
          specialtyID = '967e0a13-81aa-48f2-8bea-ce0111ddfc94';
        }
        if (urlParams.has('phenopacket_id')) {
          const query = `
            query GetOpenPedigreeData($phenopacketId: uuid!) {
              pedigree:open_pedigree_data(where: {phenopacket_id: {_eq: $phenopacketId}}) {
                id
                rawData: pedigree_data
              }
            }
          `;
          const variables = {
            phenopacketId: urlParams.get('phenopacket_id')
          };
          const result = await graphql({
            query,
            variables
          });

          return onSuccess(
            JSON.stringify(
              result?.data?.pedigree[0]?.rawData?.jsonData ?? null
            )
          );
        } else {
          console.warn('No phenopacket ID has been specified. No data will be saved.')
        }
      },
      save: async ({ jsonData, svgData, setSaveInProgress }) => {
        //setSaveInProgress(true);
        const query = `
          mutation UpdateOpenPedigreeData(
            $phenopacketId: uuid!,
            $rawData: jsonb!
          ) {
            insert_family_one(
              object: {
                phenopacket_id: $phenopacketId,
                raw_open_pedigree_data: $rawData
              },
              on_conflict: {
                constraint: family_phenopacket_id_key,
                update_columns: raw_open_pedigree_data
              }
            ) {
              id
            }
          }
        `;
        const variables = {
          phenopacketId: urlParams.get('phenopacket_id'),
          rawData: {
            svgData,
            jsonData,
          },
        };
        const result = await graphql({query, variables});
        //setSaveInProgress(false);
      },
    }
  });

  const getDemographicsGenO = async function (nhsID) {
    const query = `
      query GetDemographics(
        $primaryIdentifier: String!
      ) {
        individual(
          where: {
            primary_identifier: {_eq: $primaryIdentifier}
          }
      ) {
          date_of_birth
          date_of_death
          deceased
          first_name
          last_name
          primary_identifier
          sex
          phenopacket_id
          phenopacket {
            phenotypic_features(where:{presence: {_eq: "PRESENT"}}) {
              hpo {
                id
                name
              }
            }
            genomic_interpretations {
              display_text
              report_category
              pathogenicity_text
              pathogenicity_score
            }
          }
        }
      }
    `;
    const variables = {
      primaryIdentifier: nhsID,
    };
    const result = await graphql({ query, variables });
    return result;
  }

  const getDemographicsPDS = async function (nhsID) {
    const query = `
      query GetPatientDemographicsFromSpine($nhsNumber:String!) {
        individual:getPatientFromFHIR(id:$nhsNumber) {
          birthDate
          deceased
          deceasedDateTime
          name {
            given
            family
            period {
              start
            }
          }
          gender
        }
      }
    `;
    const variables = {
      nhsNumber: nhsID,
    };
    const result = await graphql({ query, variables });
    return result;
  }

  const clearNodeDemographics = function(node, clear_hpos) {
    node.setFirstName('');
    node.setLastName('');
    node.setLifeStatus('alive');
    node.setBirthDate('');
    node.setDeathDate('');
    node.setGender('U');
    if (clear_hpos == true) {
      node.setHPO([]);
    }
  }

  const disableGenOButtons = function(create, update, view, refreshNodeMenu) {
    editor.getNodeMenu().fieldMap['createGenO'].disabled = create;
    editor.getNodeMenu().fieldMap['updateGenO'].disabled = update;
    editor.getNodeMenu().fieldMap['viewGenO'].disabled = view;
    if (refreshNodeMenu) {
      editor.getNodeMenu().update();
    }
  }

  const updateNodeOnExternalIDChange = async function (node) {
    node.setPhenopacketID('');
    if(node.isNHSNumber(node.getExternalID())) {
      var nhsID = node.getExternalID().replaceAll(' ', '');
      var result = await getDemographicsGenO(nhsID);
      if (result.data?.individual[0]) {
        clearNodeDemographics(node, true);
        node.setFirstName(result.data?.individual[0]?.first_name);
        node.setLastName(result.data?.individual[0]?.last_name);
        node.setPhenopacketID(result.data?.individual[0]?.phenopacket_id);
        node.setLifeStatus(
          result.data?.individual[0]?.deceased
            ? 'deceased'
            : 'alive'
        );
        var parsedBirthDate = new Date(result.data?.individual[0]?.date_of_birth + 'T00:00:00');
        node.setBirthDate(parsedBirthDate.toDateString());
        var parsedDeathDate = new Date(result.data?.individual[0]?.date_of_death + 'T00:00:00');
        node.setDeathDate(parsedDeathDate.toDateString());
        node.setGender(result.data?.individual[0]?.sex);
        var hpos = [];
        result.data?.individual[0]?.phenopacket?.phenotypic_features?.each(function(v) {
          hpos.push(new HPOTerm(v.hpo.id, v.hpo.name));
        });
        node.setHPO(hpos);
        var variants = [];
        result.data?.individual[0]?.phenopacket?.genomic_interpretations?.each(function(v) {
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
            var line = '';
            parts.each(function(part) {
              if (line.length + part.length > 30) {
                formatted_text += line + '\r\n';
                line = '';
              }
              line += part + ' ';
            });
            formatted_text += line;
            variants.push(formatted_text);
          }
        });
        node.setComments(variants.join('\r\n'));
        disableGenOButtons(true, false, false, false);
      } else {
        var result = await getDemographicsPDS(nhsID);
        if (result.data?.individual) {
          clearNodeDemographics(node, false);
          var names = result.data.individual.name.sort(function(a, b) {
            return new Date(b.period.start) - new Date(a.period.start);
          });
          node.setFirstName(names[0]?.given[0]);
          node.setLastName(names[0]?.family);
          node.setLifeStatus(
            result.data.individual?.deceased
              ? 'deceased'
              : 'alive'
          );
          var parsedBirthDate = new Date(result.data.individual?.birthDate + 'T00:00:00');
          node.setBirthDate(parsedBirthDate.toDateString());
          var parsedDeathDate = new Date(result.data.individual?.deceasedDateTime);
          node.setDeathDate(parsedDeathDate.toDateString());
          node.setGender(result.data.individual.gender);
        }
        disableGenOButtons(false, true, true, false);
      }
      editor.getGraph().setProperties(node.getID(), node.getProperties());
      editor.getNodeMenu().update();
    } else {
      disableGenOButtons(true, true, true, false);
    }
  }

  // hook externalid up to the gen-o or NHS PDS databases
  document.observe('pedigree:person:set:externalid', async (event) => {
    updateNodeOnExternalIDChange(event.memo.node);
  });

  const getPhenopacketID = async function (nhsID) {
    const query = `
      query GetDemographics(
        $primaryIdentifier: String!
      ) {
        individual(
          where: {
            primary_identifier: {_eq: $primaryIdentifier}
          }
      ) {
          phenopacket_id
        }
      }
    `;
    const variables = {
      primaryIdentifier: nhsID,
    };
    const result = await graphql({ query, variables });
    return result.data?.individual[0]?.phenopacket_id;
  }

  const updateExternalHPO = async function (phenopacketId, hpos) {
    var hpoTerms = [];
    var linkedHpoTerms = [];
    var linkedHpoIds = [];
    hpos.each( function (hpo) {
      var hpoID = HPOTerm.desanitizeID(hpo.getID());
      hpoTerms.push({ id: hpoID, name: hpo.getName() });
      linkedHpoTerms.push({ phenopacket_id: phenopacketId, hpo_id: hpoID, presence: "PRESENT" });
      linkedHpoIds.push(hpoID);
    });

    const query = `
      mutation UpdatePhenotypicFeaturesViaPedigree(
        $phenopacketId: uuid!,
        $hpoTerms: [hpo_insert_input!]! = {},
        $linkedHpoTerms: [phenotypic_feature_insert_input!]! = {},
        $linkedHpoIds: [String!]! = ""
      ) {
        insert_hpo(
          objects: $hpoTerms,
          on_conflict: {
            constraint: hpo_pkey,
            update_columns: []
          }
        ) {
          affected_rows
        }
        insert_phenotypic_feature(
          objects: $linkedHpoTerms,
          on_conflict: {
            constraint: phenotypic_feature_hpo_id_phenopacket_id_key,
            update_columns: []
          }
        ) {
          affected_rows
          returning {
            hpo {
              id
              name
            }
          }
        }
        delete_phenotypic_feature(
          where: {
            hpo_id: {_nin: $linkedHpoIds},
            _and: { phenopacket_id: {_eq: $phenopacketId} }
          }
        ) {
          affected_rows
        }
      }
    `;
    const variables = {
      phenopacketId: phenopacketId,
      hpoTerms: hpoTerms,
      linkedHpoTerms: linkedHpoTerms,
      linkedHpoIds: linkedHpoIds,
    };
    const result = await graphql({ query, variables });
    return result;
  }

  document.observe('pedigree:person:set:hpo', async (event) => {
    var result = await updateExternalHPO(event.memo.node.getPhenopacketID(), event.memo.value);
  });

  const insertPhenopacket = async function () {
    const query = `
      mutation InsertPhenopacket {
        phenopacket:insert_phenopacket_one(
          object: {}
        ) {
          id
        }
      }
    `;
    const result = await graphql({ query });
    return result.data?.phenopacket?.id;
  }

  const insertInterpretation = async function (phenopacketID) {
    const query = `
      mutation InsertInterpretation(
        $phenopacket_id: uuid!,
        $specialty_id: uuid!
      ) {
        interpretation:insert_interpretation_one(
          object:
            {
              phenopacket_id: $phenopacket_id,
              specialty_id: $specialty_id
            }
        ) {
            id
        }
      }
    `;
    const variables = {
      phenopacket_id: phenopacketID,
      specialty_id: specialtyID
    };
    const result = await graphql({ query, variables });
    return result.data?.interpretation?.id;
  }

  const insertCaseHistory = async function (phenopacketID, status="Referred", notes="Added via Open Pedigree") {
    var query = `
      query GetCaseStatus($status: String! = "Referred") {
        case_status(where: {status: {_eq: $status}}) {
          id
        }
      }
    `;
    var variables = {
      status: status
    }
    var result = await graphql({ query, variables });
    var case_status_id = result.data?.case_status[0]?.id;
    query = `
      mutation AddCaseStatus(
        $phenopacket_id: uuid!,
        $case_status_id: uuid!,
        $notes: String
      ) {
        case_history:insert_case_history_one(
          object: {
            phenopacket_id: $phenopacket_id,
            case_status_id: $case_status_id,
            notes: $notes,
          }
        ) {
          id
        }
      }
    `;
    variables = {
      phenopacket_id: phenopacketID,
      case_status_id: case_status_id,
      notes: notes
    };
    result = await graphql({ query, variables });
    return result.data?.case_history?.id;
  }

  const upsertIndividual = async function (node) {
    const query = `
      mutation UpsertIndividual(
        $primary_identifier: String!,
        $phenopacket_id: uuid!,
        $first_name: String,
        $last_name: String,
        $deceased: Boolean,
        $date_of_birth: date,
        $date_of_death: date,
        $sex: sex
      ) {
        individual:insert_individual_one(
          object: {
            primary_identifier: $primary_identifier,
            phenopacket_id: $phenopacket_id,
            first_name: $first_name,
            last_name: $last_name,
            deceased: $deceased,
            date_of_birth: $date_of_birth,
            date_of_death: $date_of_death,
            sex: $sex
          },
          on_conflict: {
            constraint: individual_primary_identifier_key,
            update_columns: [
              first_name,
              last_name,
              deceased,
              date_of_birth,
              date_of_death,
              sex
            ]
          }
        ) {
            id
          }
        }
      `;

    const variables = {
      primary_identifier: node.getExternalID(true),
      phenopacket_id: node.getPhenopacketID(),
      first_name: node.getFirstName(),
      last_name: node.getLastName(),
      deceased: node.getLifeStatus() == 'deceased' ? true : false,
      date_of_birth: node.getBirthDate() ? node.getBirthDate().toISOString().split('T')[0] : null,
      date_of_death: node.getDeathDate() ? node.getDeathDate().toISOString().split('T')[0] : null,
      sex: node.getGender(true)
    }
    const result = await graphql({ query, variables });
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
      if (phenopacketID && individualID && interpretationID && caseStetusID) {
        console.log('Gen-O patient record was successfully created');
      } else {
        console.log('Failed to create Gen-O record patient record.');
        console.log('phenopacketID:', phenopacketID);
        console.log('individualID:', individualID);
        console.log('interpretationID:', interpretationID);
        console.log('caseStetusID:', caseStetusID);
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
      var newBirthDate = event.memo.node.getBirthDate().toISOString().split('T')[0];
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
      var newDeathDate = event.memo.node.getDeathDate().toISOString().split('T')[0];
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
      changedFields.each( function (changedField) {
        updateSummary += `${changedField[0]}: ${changedField[1]} -> ${changedField[2]}\n`
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
    if(event.memo.node.isNHSNumber(event.memo.node.getExternalID())) {
      if (event.memo.node.getPhenopacketID()) {
        disableGenOButtons(true, false, false, true);
      } else {
        disableGenOButtons(false, true, true, true);
      }
    } else {
      disableGenOButtons(true, true, true, true);
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
});

document.observe('pedigree:person:set:disorders', function(event) {
  // Note for future, for some reason it is executed twice on update...
  // Function to print Person external ID and disorder terms when the latter are updated.
  console.log('Person disorders were updated!')
  console.log('Person external ID:', event.memo.node.getExternalID())
  console.log('Disorders:')
  var disorders = event.memo.value
  for(var i = 0; i < disorders.length; i++) {
    var disorder = disorders[i]
    console.log(`${i}) ID: ${disorder.getDesanitizedDisorderID()}, Name: ${disorder.getName()}`);
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
    console.log(`${i}) ID: ${HPOTerm.desanitizeID(hpo.getID())}, Name: ${hpo.getName()}`);
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
    console.log(`${i}) ID: ${gene.getID()}, Name: ${gene.getSymbol()}`);
  }
});

document.observe('custom:selectize:load:genes', async function(event) {
  // Function to populate selecitzeJS control with HGNC genes from Gen-O.
  HGNC_GENES.forEach(function(item) {
    var gene = new Gene(item.hgnc_id, item.symbol, item.locus_group);
    item = {
      id: gene.getID(),
      name: gene.getSymbol(),
      value: gene.getDisplayName(),
      group: gene.getGroup(),
    }
    event.memo.addOption(item);
  });
  event.memo.refreshOptions();
});

document.observe('custom:selectize:load:disorders', async function(event) {
  // Function to populate selecitzeJS control with ORPHA and ICD-10 genes from Gen-O.
  GEN_O_DISORDERS.forEach(function(item) {
    var disorder = new Disorder(item.ontology_id, item.name);
    item = {
      id: disorder.getDesanitizedDisorderID(),
      name: disorder.getName(),
      value: disorder.getDisplayName(),
    }
    event.memo.addOption(item);
  });
  event.memo.refreshOptions();
});

document.observe('custom:selectize:load:hpos', async function(event) {
  // Function to populate selecitzeJS control with ORPHA and ICD-10 genes from Gen-O.
  HPO_TERMS.forEach(function(item) {
    var hpo = new HPOTerm(item.id, item.name);
    item = {
      id: hpo.getDesanitizedID(),
      name: hpo.getName(),
      value: hpo.getDisplayName(),
    }
    event.memo.addOption(item);
  });
  event.memo.refreshOptions();
});