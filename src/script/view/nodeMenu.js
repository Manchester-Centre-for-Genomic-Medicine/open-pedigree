import Disorder from 'pedigree/disorder';
import HPOTerm from 'pedigree/hpoTerm';
import Gene from 'pedigree/gene';
import Helpers from 'pedigree/model/helpers';
import GraphicHelpers from 'pedigree/view/graphicHelpers';
import AgeCalc from 'pedigree/view/ageCalc';

/**
 * NodeMenu is a UI Element containing options for AbstractNode elements
 *
 * @class NodeMenu
 * @constructor
 * @param {Array} data Contains objects corresponding to different menu items
 *
 {
 [
    {
        'name' : the name of the menu item,
        'label' : the text label above this menu option,
        'type' : the type of form input. (eg. 'radio', 'date-picker', 'text', 'textarea', 'disease-picker', 'select'),
        'values' : [
                    {'actual' : actual value of the option, 'displayed' : the way the option will be seen in the menu} ...
                    ]
    }, ...
 ]
 }

 Note: when an item is specified as "inactive" it is completely removed from the menu; when it
       is specified as "disabled" it is greyed-out and does not allow selection, but is still visible.
 */
var NodeMenu = Class.create({
  initialize : function(data, tabs, otherCSSClass) {
    this.canvas = editor.getWorkspace().canvas || $('body');
    var cssClass = 'menu-box';
    if (otherCSSClass) {
      cssClass += ' ' + otherCSSClass;
    }
    this.menuBox = new Element('div', {'class' : cssClass});

    this.closeButton = new Element('span', {'class' : 'close-button'}).update('×');
    this.menuBox.insert({'top': this.closeButton});
    this.closeButton.observe('click', this.hide.bindAsEventListener(this));

    this.form = new Element('form', {'method' : 'get', 'action' : '', 'class': 'tabs-content'});

    this.tabs = {};
    this.tabHeaders = {};
    if (tabs && tabs.length > 0) {
      this.tabTop = new Element('dl', {'class':'tabs'});
      for (var i = 0; i < tabs.length; i++) {
        var tabName = tabs[i];
        var activeClass = (i == 0) ? 'active' : '';
        this.tabs[tabName] = new Element('div', {'id': 'tab_' + tabName, 'class': 'content ' + activeClass});
        this.form.insert(this.tabs[tabName]);

        this.tabHeaders[tabName] = new Element('dd', {'class': activeClass}).insert('<a>' + tabName + '</a>');
        var _this = this;
        var switchTab = function(tabName) {
          return function() {
            for (var tab in _this.tabs) {
              if (_this.tabs.hasOwnProperty(tab)) {
                if (tab != tabName) {
                  _this.tabs[tab].className = 'content';
                  _this.tabHeaders[tab].className = '';
                } else {
                  _this.tabs[tab].className = 'content active';
                  _this.tabHeaders[tab].className = 'active';
                }
              }
            }
            _this.reposition();
          };
        };
        this.tabHeaders[tabName].observe('click', switchTab(tabName));
        this.tabTop.insert(this.tabHeaders[tabName]);
      }
      var div = new Element('div', {'class': 'tabholder'}).insert(this.tabTop).insert(this.form);
      this.menuBox.insert({'bottom' : div});
    } else {
      this.singleTab = new Element('div', {'class': 'tabholder'}).insert(this.form);
      this.menuBox.insert({'bottom' : this.singleTab});
      this.closeButton.addClassName('close-button-old');
      this.form.addClassName('content');
    }

    this.fieldMap = {};
    // Generate fields
    var _this = this;
    data.each(function(d) {
      if (typeof (_this._generateField[d.type]) == 'function') {
        var insertLocation = _this.form;
        if (d.tab && _this.tabs.hasOwnProperty(d.tab)) {
          insertLocation = _this.tabs[d.tab];
        }
        insertLocation.insert(_this._generateField[d.type].call(_this, d));
      }
    });
    
    // Date picker event queues used to fire only the last on change event after user is inactive for X secs.
    this._datepickerEventQueue = {
      'date_of_birth': [],
      'date_of_death': [],
    }

    // Insert in document
    this.hide();
    editor.getWorkspace().getWorkArea().insert(this.menuBox);

    this._onClickOutside = this._onClickOutside.bindAsEventListener(this);

    // Attach pickers
    // date
    /*
    // Original XWiki control was replaced with html input type=date 
    var crtYear = new Date().getFullYear();
    window.dateTimePicker = new XWiki.widgets.DateTimePicker({
      year_range: [crtYear - 99, crtYear + 1],
      after_navigate : function(date) {
        this._selector.updateSelectedDate({day: date.getDate(), month: date.getMonth(), year : date.getYear() + 1900}, false);
      }
    });
    */
    // disease
    this.form.select('input.suggest-orphanet').each(function(item) {
      if (!item.hasClassName('initialized')) {
        jQuery(item).selectize({
          maxItems: null,
          valueField: 'value',
          searchField: ['name', 'id'],
          options: [],
          create: false,
          maxOptions: 100,
          delimiter: '||',
          render: {
            item: function(item, escape) {
              return '<div>' + escape(item.value) + '</div>';
            },
            option: function(item, escape) {
              var div = '<div><table>' +
              '<tr><td><span class="id disorder">' + escape(item.id) + '</span></td>' +
              '<td><span class="name">' + escape(item.name) + '</span></td></tr>';
              div += '</table></div>';
              return div;
            },
          },
          onInitialize: function() {
            // Code to load gene data from Gen-O database (observed in app.js).
            document.fire('custom:selectize:load:disorders', this);
            /*
            // Code to load gene data from HGNC API.
            var _this = this
            jQuery.ajax({
              url: 'https://api.orphacode.org/EN/ClinicalEntity',
              type: 'GET',
              headers: {
                // ORPHA requires api key, but it can be anything.
                'apikey': '5d29dd2f-8021-41e2-8146-3548d7ba409b'
              },
              async: false,
              error: function() {
                return;
              },
              success: function(res) {
                res.forEach(function(item) {
                  var disorder = new Disorder(item['ORPHAcode'], item['Preferred term'])
                  item = {
                    id: disorder.getDesanitizedDisorderID(),
                    name: disorder.getName(),
                    value: disorder.getDisplayName(),
                  }
                  _this.addOption(item);
                });
                _this.refreshOptions();
              }
            });
            */
          },
          onChange: function() {
            this.fieldName = 'disorders';
            document.fire('custom:selectize:changed', this);
          },          
        });

        /*
        // Code of the original Open Pedigree disorder selector control.
        // Create the Suggest.
        item._suggest = new PhenoTips.widgets.Suggest(item, {
          script: Disorder.getOMIMServiceURL() + '&',
          queryProcessor: typeof(PhenoTips.widgets.SolrQueryProcessor) == 'undefined' ? null : new PhenoTips.widgets.SolrQueryProcessor({
            'name' : {'wordBoost': 20, 'phraseBoost': 40},
            'nameSpell' : {'wordBoost': 50, 'phraseBoost': 100, 'stubBoost': 20},
            'keywords' : {'wordBoost': 2, 'phraseBoost': 6, 'stubBoost': 2},
            'text' : {'wordBoost': 1, 'phraseBoost': 3, 'stubBoost': 1},
            'textSpell' : {'wordBoost': 2, 'phraseBoost': 5, 'stubBoost': 2, 'stubTrigger': true}
          }, {
            '-nameSort': ['\\**', '\\+*', '\\^*']
          }),
          varname: 'q',
          noresults: 'No matching terms',
          json: true,
          resultsParameter : 'rows',
          resultId : 'id',
          resultValue : 'name',
          resultInfo : {},
          enableHierarchy: false,
          fadeOnClear : false,
          timeout : 30000,
          parentContainer : $('body')
        });
        if (item.hasClassName('multi') && typeof(PhenoTips.widgets.SuggestPicker) != 'undefined') {
          item._suggestPicker = new PhenoTips.widgets.SuggestPicker(item, item._suggest, {
            'showKey' : false,
            'showTooltip' : false,
            'showDeleteTool' : true,
            'enableSort' : false,
            'showClearTool' : true,
            'inputType': 'hidden',
            'listInsertionElt' : 'input',
            'listInsertionPosition' : 'after',
            'acceptFreeText' : true
          });
        }
        */

        item.addClassName('initialized');
        
        /*
        // Code of the original Open Pedigree disorder selector control.
        document.observe('ms:suggest:containerCreated', function(event) {
          if (event.memo && event.memo.suggest === item._suggest) {
            item._suggest.container.setStyle({'overflow': 'auto', 'maxHeight': document.viewport.getHeight() - item._suggest.container.cumulativeOffset().top + 'px'});
          }
        });
        */
      }
    });
    // genes
    this.form.select('input.suggest-genes').each(function(item) {
      if (!item.hasClassName('initialized')) {
        jQuery(item).selectize({
          maxItems: null,
          valueField: 'value',
          searchField: ['id', 'name'],
          options: [],
          /*
          // Uncomment this function to enable custom gene input (i.e. genes without HGNC IDs).
          create: function(input) {
            var gene = new Gene(null, input);
            return {'id': gene.getID(), 'name': gene.getSymbol(), 'value': gene.getDisplayName()};
          },
          */
          maxOptions: 100,
          delimiter: ',',
          render: {
            item: function(item, escape) {
              return '<div>' + escape(item.value) + '</div>';
            },
            option: function(item, escape) {
              var div = '<div><table>' +
              '<tr><td><span class="id gene">' + escape(item.id) + '</span></td>' +
              '<td><span class="name">' + escape(item.name) + '</span></td></tr>' + 
              '<tr><td /><td><span class="italic">' + escape(item.group) + '</span></td></tr>';
              div += '</table></div>';
              return div;
            },
          },
          onInitialize: function() {
            // Code to load gene data from Gen-O database (observed in app.js).
            document.fire('custom:selectize:load:genes', this);
            /*
            // Code to load gene data from HGNC API.
            var _this = this
            jQuery.ajax({
              url: 'https://ftp.ebi.ac.uk/pub/databases/genenames/hgnc/json/non_alt_loci_set.json',
              type: 'GET',
              headers: {
                'Accept': 'application/json'
              },
              async: false,
              error: function() {
                console.log('ERROR: Failed to obtain HGNC genes from https://ftp.ebi.ac.uk.');
                return;
              },
              success: function(res) {
                res.response.docs.forEach(function(item) {
                  var gene = new Gene(item.hgnc_id, item.symbol, item.locus_group);
                  item = {
                    id: gene.getID(),
                    name: gene.getSymbol(),
                    value: gene.getDisplayName(),
                    group: gene.getGroup(),
                  }
                  _this.addOption(item);
                });
                _this.refreshOptions();
              }
            });
            */
          },
          onChange: function() {
            this.fieldName = 'candidate_genes';
            document.fire('custom:selectize:changed', this);
          },          
        });
        /*
        // Code of the original Open Pedigree gene selector control.
        var geneServiceURL = new XWiki.Document('GeneNameService', 'PhenoTips').getURL('get', 'outputSyntax=plain');
        item._suggest = new PhenoTips.widgets.Suggest(item, {
          script: geneServiceURL + '&json=true&',
          varname: 'q',
          noresults: 'No matching terms',
          resultsParameter : 'docs',
          json: true,
          resultId : 'symbol',
          resultValue : 'symbol',
          resultInfo : {},
          enableHierarchy: false,
          tooltip :false,
          fadeOnClear : false,
          timeout : 30000,
          parentContainer : $('body')
        });
        if (item.hasClassName('multi') && typeof(PhenoTips.widgets.SuggestPicker) != 'undefined') {
          item._suggestPicker = new PhenoTips.widgets.SuggestPicker(item, item._suggest, {
            'showKey' : false,
            'showTooltip' : false,
            'showDeleteTool' : true,
            'enableSort' : false,
            'showClearTool' : true,
            'inputType': 'hidden',
            'listInsertionElt' : 'input',
            'listInsertionPosition' : 'after',
            'acceptFreeText' : true
          });
        }
        */

        item.addClassName('initialized');

        /*
        // Code of the original Open Pedigree gene selector control.
        document.observe('ms:suggest:containerCreated', function(event) {
          if (event.memo && event.memo.suggest === item._suggest) {
            item._suggest.container.setStyle({'overflow': 'auto', 'maxHeight': document.viewport.getHeight() - item._suggest.container.cumulativeOffset().top + 'px'});
          }
        });
        */
      }
    });
    // HPO terms
    this.form.select('input.suggest-hpo').each(function(item) {
      if (!item.hasClassName('initialized')) {
        jQuery(item).selectize({
          maxItems: null,
          valueField: 'value',
          searchField: ['name', 'synonym', 'ontologyId'],
          options: [],
          create: false,
          maxOptions: 100,
          render: {
            item: function(item, escape) {
              return '<div>' + escape(item.value) + '</div>';
            },
            option: function(item, escape) {
              var div = '<div><table>' +
              '<tr><td><span class="id hpo">' + escape(item.id) + '</span></td>' +
              '<td><span class="name">' + escape(item.name) + '</span></td></tr>';
              if (item.synonym){
                '<tr><td /><td><span class="italic">' + escape(item.synonym) + '</span></td></tr>';
              }
              div += '</table></div>';
              return div;
            },
          },
          onInitialize: function() {
            // Code to load HPO data from Gen-O database (observed in app.js).
            document.fire('custom:selectize:load:hpos', this);
            /*
            // Code to load hpo data from HPO API.
            var _this = this
            jQuery.ajax({
              url: 'https://hpo.jax.org/api/hpo/search/?q=HP%3A&max=-1&offset=0&category=terms',
              type: 'GET',
              async: false,
              error: function() {
                console.log('ERROR: Failed to obtain HPO terms from hpo.jax.org/api.');
                return;
              },
              success: function(res) {
                res.terms.each(function(item){
                  var hpoTerm = new HPOTerm(item.id, item.name);
                  item.value = hpoTerm.getDisplayName();
                  _this.addOption(item);
                });
                _this.refreshOptions();
              }
            });
            */
          },
          onChange: function() {
            this.fieldName = 'hpo_positive';
            document.fire('custom:selectize:changed', this);
          },
        });
        
        /*
        // Code of the original Open Pedigree HPO selector control.
        var solrServiceURL = HPOTerm.getServiceURL();
        item._suggest = new PhenoTips.widgets.Suggest(item, {
          script: solrServiceURL + 'rows=100&',
          queryProcessor: typeof(PhenoTips.widgets.SolrQueryProcessor) == 'undefined' ? null : new PhenoTips.widgets.SolrQueryProcessor({
            'name' : {'wordBoost': 10, 'phraseBoost': 20},
            'nameSpell' : {'wordBoost': 18, 'phraseBoost': 36, 'stubBoost': 14},
            'nameExact' : {'phraseBoost': 100},
            'namePrefix' : {'phraseBoost': 30},
            'synonym' : {'wordBoost': 6, 'phraseBoost': 15},
            'synonymSpell' : {'wordBoost': 10, 'phraseBoost': 25, 'stubBoost': 7},
            'synonymExact' : {'phraseBoost': 70},
            'synonymPrefix' : {'phraseBoost': 20},
            'text' : {'wordBoost': 1, 'phraseBoost': 3, 'stubBoost': 1},
            'textSpell' : {'wordBoost': 2, 'phraseBoost': 5, 'stubBoost': 2, 'stubTrigger': true},
            'id' : {'activationRegex' : /^HP:[0-9]+$/i, 'mandatory' : true, 'transform': function(query) {
              return query.toUpperCase().replace(/:/g, '\\:');
            }},
            'alt_id' : {'activationRegex' : /^HP:[0-9]+$/i, 'mandatory' : true, 'transform': function(query) {
              return query.toUpperCase().replace(/:/g, '\\:');
            }}
          }, {
            'term_category': ['HP:0000118']
          }
          ),
          varname: 'q',
          noresults: 'No matching terms',
          json: true,
          resultsParameter : 'rows',
          resultId : 'id',
          resultValue : 'name',
          resultAltName: 'synonym',
          resultCategory : 'term_category',
          resultInfo : {},
          enableHierarchy: false,
          resultParent : 'is_a',
          fadeOnClear : false,
          timeout : 30000,
          parentContainer : $('body')
        });
        if (item.hasClassName('multi') && typeof(PhenoTips.widgets.SuggestPicker) != 'undefined') {
          item._suggestPicker = new PhenoTips.widgets.SuggestPicker(item, item._suggest, {
            'showKey' : false,
            'showTooltip' : false,
            'showDeleteTool' : true,
            'enableSort' : false,
            'showClearTool' : true,
            'inputType': 'hidden',
            'listInsertionElt' : 'input',
            'listInsertionPosition' : 'after',
            'acceptFreeText' : true
          });
        }
        */

        item.addClassName('initialized');
        
        /* 
        // Code of the original Open Pedigree HPO selector control.
        document.observe('ms:suggest:containerCreated', function(event) {
          if (event.memo && event.memo.suggest === item._suggest) {
            item._suggest.container.setStyle({'overflow': 'auto', 'maxHeight': document.viewport.getHeight() - item._suggest.container.cumulativeOffset().top + 'px'});
          }
        });
        */
      }
    });

    // Update disorder colors
    this._updateDisorderColor = function(id, color) {
      this.menuBox.select('.field-disorders li input[value="' + id + '"]').each(function(item) {
        var colorBubble = item.up('li').down('.disorder-color');
        if (!colorBubble) {
          colorBubble = new Element('span', {'class' : 'disorder-color'});
          item.up('li').insert({top : colorBubble});
        }
        colorBubble.setStyle({background : color});
      });
    }.bind(this);
    document.observe('disorder:color', function(event) {
      if (!event.memo || !event.memo.id || !event.memo.color) {
        return;
      }
      _this._updateDisorderColor(event.memo.id, event.memo.color);
    });

    // Update hpo colors
    this._updateHPOColor = function(id, color) {
      this.menuBox.select('.field-hpo_positive li input[value="' + id + '"]').each(function(item) {
        var colorBubble = item.up('li').down('.disorder-color');
        if (!colorBubble) {
          colorBubble = new Element('span', {'class' : 'disorder-color'});
          item.up('li').insert({top : colorBubble});
        }
        colorBubble.setStyle({background : color});
      });
    }.bind(this);
    document.observe('hpo:color', function(event) {
      if (!event.memo || !event.memo.id || !event.memo.color) {
        return;
      }
      _this._updateHPOColor(event.memo.id, event.memo.color);
    });

    // Update gene colors
    this._updateGeneColor = function(id, color) {
      this.menuBox.select('.field-candidate_genes li input[value="' + id + '"]').each(function(item) {
        var colorBubble = item.up('li').down('.disorder-color');
        if (!colorBubble) {
          colorBubble = new Element('span', {'class' : 'disorder-color'});
          item.up('li').insert({top : colorBubble});
        }
        colorBubble.setStyle({background : color});
      });
    }.bind(this);
    document.observe('gene:color', function(event) {
      if (!event.memo || !event.memo.id || !event.memo.color) {
        return;
      }
      _this._updateGeneColor(event.memo.id, event.memo.color);
    });
  },

  _generateEmptyField : function (data) {
    var result = new Element('div', {'class' : 'field-box field-' + data.name});
    var label = new Element('label', {'class' : 'field-name'}).update(data.label);
    result.inputsContainer = new Element('div', {'class' : 'field-inputs'});
    result.insert(label).insert(result.inputsContainer);
    this.fieldMap[data.name] = {
      'type' : data.type,
      'element' : result,
      'default' : data['default'] || '',
      'crtValue' : data['default'] || '',
      'function' : data['function'],
      'inactive' : false,
      'disabled' : data['disabled']
    };
    return result;
  },

  _handleDatePickerChangeEvent : function (field, event, fireEventName) {
    var _this = this;
    // Add event to a datepicker queue (date of birth and date of death events are processed separately).
    _this._datepickerEventQueue[field.name].push(event);
    var eventNum = _this._datepickerEventQueue[field.name].length;
    // Wait for X sec and trigger update if no new events were added to the queue.
    setTimeout(function(eventNum) {
      if (_this._datepickerEventQueue[field.name].length == eventNum) {
        document.fire(fireEventName, _this._datepickerEventQueue[field.name].pop());
        _this._datepickerEventQueue[field.name] = [];
        field.fire('pedigree:change');
      }
    }, 2000, eventNum);
  },

  _attachFieldEventListeners : function (field, eventNames, values) {
    var _this = this;
    eventNames.each(function(eventName) {
      field.observe(eventName, function(event) {
        if (_this._updating) {
          return;
        } // otherwise a field change triggers an update which triggers field change etc
        var target = _this.targetNode;
        if (!target) {
          return;
        }
        _this.fieldMap[field.name].crtValue = field._getValue && field._getValue()[0];
        var method = _this.fieldMap[field.name]['function'];

        if (target.getSummary()[field.name].value == _this.fieldMap[field.name].crtValue) {
          return;
        }

        if (method.indexOf('set') == 0 && typeof(target[method]) == 'function') {
          var properties = {};
          properties[method] = _this.fieldMap[field.name].crtValue;
          var event = { 'nodeID': target.getID(), 'properties': properties };
          if (field.name == 'date_of_birth' || field.name == 'date_of_death') {
            _this._handleDatePickerChangeEvent(field, event, 'pedigree:node:setproperty');
          } else {
            document.fire('pedigree:node:setproperty', event);
          }
        } else {
          var properties = {};
          properties[method] = _this.fieldMap[field.name].crtValue;
          var event = { 'nodeID': target.getID(), 'modifications': properties };
          if (field.name == 'date_of_birth' || field.name == 'date_of_death') {
            _this._handleDatePickerChangeEvent(field, event, 'pedigree:node:modify');
          } else {
            document.fire('pedigree:node:modify', event);
          }
        }
        if (field.name != 'date_of_birth' && field.name != 'date_of_death') {
          field.fire('pedigree:change');
        }
      });
    });
  },

  _attachButtonEventListeners : function (button, eventNames) {
    var _this = this;
    eventNames.each(function(eventName) {
      button.observe(eventName, function(event) {
        if (_this._updating) {
          return;
        } // otherwise a button change triggers an update which triggers button change etc
        var target = _this.targetNode;
        if (!target) {
          return;
        }
        var event = { 'nodeID': target.getID(), 'action': button.down('input[type=button]').name };
        document.fire('pedigree:node:buttonaction', event);
      });
    });
  },

  update: function(newTarget) {
    if (newTarget) {
      this.targetNode = newTarget;
    }

    if (this.targetNode) {
      this._updating = true;   // needed to avoid infinite loop: update -> _attachFieldEventListeners -> update -> ...
      this._setCrtData(this.targetNode.getSummary());
      this.reposition();
      delete this._updating;
    }
  },

  _generateField : {
    'radio' : function (data) {
      var result = this._generateEmptyField(data);
      var columnClass = data.columns ? 'field-values-' + data.columns + '-columns' : 'field-values';
      var values = new Element('div', {'class' : columnClass});
      result.inputsContainer.insert(values);
      var _this = this;
      var _generateRadioButton = function(v) {
        var radioLabel = new Element('label', {'class' : data.name + '_' + v.actual}).update(v.displayed);
        var radioButton = new Element('input', {type: 'radio', name: data.name, value: v.actual});
        radioLabel.insert({'top': radioButton});
        radioButton._getValue = function() {
          return [this.value];
        }.bind(radioButton);
        values.insert(radioLabel);
        _this._attachFieldEventListeners(radioButton, ['click']);
      };
      data.values.each(_generateRadioButton);

      return result;
    },
    'checkbox' : function (data) {
      var result = this._generateEmptyField(data);
      var checkbox = new Element('input', {type: 'checkbox', name: data.name, value: '1'});
      result.down('label').insert({'top': checkbox});
      checkbox._getValue = function() {
        return [this.checked];
      }.bind(checkbox);
      this._attachFieldEventListeners(checkbox, ['click']);
      return result;
    },
    'button' : function (data) {
      var result = this._generateEmptyField(data);
      var button = Element('input', {type: 'button', name : data.name,  value: data.value, 'class' : 'button'}).wrap('span', {'class' : 'buttonwrapper'});
      result.inputsContainer.insert(button);
      button._getValue = function() {
        return [this.value];
      }.bind(button);
      this._attachButtonEventListeners(button, ['click']);
      return result;
    },
    'text' : function (data) {
      var result = this._generateEmptyField(data);
      var text = new Element('input', {type: 'text', name: data.name});
      if (data.tip) {
        text.placeholder = data.tip;
      }
      result.inputsContainer.insert(text);
      text.wrap('span');
      text._getValue = function() {
        return [this.value];
      }.bind(text);
      //this._attachFieldEventListeners(text, ['keypress', 'keyup'], [true]);
      this._attachFieldEventListeners(text, ['keyup'], [true]);
      return result;
    },
    'textarea' : function (data) {
      var result = this._generateEmptyField(data);
      var properties = {name: data.name};
      properties['class'] = 'textarea-'+data.rows+'-rows'; // for compatibiloity with older browsers not accepting {class: ...}
      var text = new Element('textarea', properties);
      result.inputsContainer.insert(text);
      //text.wrap('span');
      text._getValue = function() {
        return [this.value];
      }.bind(text);
      this._attachFieldEventListeners(text, ['keyup'], [true]);
      return result;
    },
    /*
    // Original XWiki control was replaced with html input type=date 
    'date-picker' : function (data) {
      var result = this._generateEmptyField(data);
      var datePicker = new Element('input', {type: 'text', 'class': 'xwiki-date', name: data.name, 'title': data.format, alt : '' });
      result.insert(datePicker);
      datePicker._getValue = function() {
        return [this.alt && Date.parseISO_8601(this.alt)];
      }.bind(datePicker);
      this._attachFieldEventListeners(datePicker, ['xwiki:date:changed']);
      return result;
    },
    */
    'date-picker' : function (data) {
      var result = this._generateEmptyField(data);
      var datePicker = document.createElement("INPUT");
      datePicker.setAttribute("type", "date");
      datePicker.setAttribute("name", data.name);
      result.insert(datePicker);
      datePicker._getValue = function() {
        var date = '';
        if (this.value) {
          date = new Date(this.value + 'T00:00:00');
        }
        return [date];
      }.bind(datePicker);
      this._attachFieldEventListeners(datePicker, ['change']);
      return result;
    },
    'disease-picker' : function (data) {
      var result = this._generateEmptyField(data);
      var diseasePicker = new Element('input', {type: 'text', 'class': 'suggest multi suggest-orphanet', name: data.name});
      result.insert(diseasePicker);
      diseasePicker._getValue = function() {
        var results = [];
        if (this.value) {
          var disorders = this.value.split('||');
          disorders.each(function(item){
            // Item is disorders term name in display format (ID | name).
            results.push(new Disorder(null, item));
          })
        }
        /*
        // Code of the original Open Pedigree disorder selector control.
        var container = this.up('.field-box');
        if (container) {
          container.select('input[type=hidden][name=' + data.name + ']').each(function(item){
            results.push(new Disorder(item.value, item.next('.value') && item.next('.value').firstChild.nodeValue || item.value));
          });
        }
        */
        return [results];
      }.bind(diseasePicker);
      // Forward the 'custom:selection:changed' to the input
      var _this = this;
      /*
      // Code of the original Open Pedigree disorder selector control.
      document.observe('custom:selection:changed', function(event) {
        if (event.memo && event.memo.fieldName == data.name && event.memo.trigger && event.findElement() != event.memo.trigger && !event.memo.trigger._silent) {
          Event.fire(event.memo.trigger, 'custom:selection:changed');
          _this.reposition();
        }
      });
      */
      document.observe('custom:selectize:changed', function(event) {
        if (event.memo && event.memo.fieldName == data.name && event.memo.trigger && event.findElement() != event.memo.trigger && !event.memo.trigger._silent
            && event.memo.$input) {
          Event.fire(event.memo.$input[0], 'custom:selectize:changed');
          _this.reposition();
        }
      });

      // Code of the original Open Pedigree disorder selector control.
      //this._attachFieldEventListeners(diseasePicker, ['custom:selection:changed']);
      this._attachFieldEventListeners(diseasePicker, ['custom:selectize:changed']);
      return result;
    },
    'hpo-picker' : function (data) {
      var result = this._generateEmptyField(data);
      var hpoPicker = new Element('input', {type: 'text', 'class': 'suggest multi suggest-hpo', name: data.name});
      result.insert(hpoPicker);
      hpoPicker._getValue = function() {
        var results = [];
        // var container = this.up('.field-box');
        if (this.value) {
          var hpos = this.value.split(',');
          hpos.each(function(item){
            // Item is hpo term name in display format (ID | name).
            results.push(new HPOTerm(null, item));
          })
        }
        /*
        // Code of the original Open Pedigree HPO selector control.
        var container = this.up('.field-box');
        if (container) {
          container.select('input[type=hidden][name=' + data.name + ']').each(function(item){
            results.push(new HPOTerm(item.value, item.next('.value') && item.next('.value').firstChild.nodeValue || item.value));
          });
        }
        */
        return [results];
      }.bind(hpoPicker);
      // Forward the 'custom:selection:changed' to the input
      var _this = this;
      /*
      // Code of the original Open Pedigree HPO selector control.
      document.observe('custom:selection:changed', function(event) {     
        if (event.memo && event.memo.fieldName == data.name && event.memo.trigger && event.findElement() != event.memo.trigger && !event.memo.trigger._silent) {
          Event.fire(event.memo.trigger, 'custom:selection:changed');
          _this.reposition();
        }
      });
      */

      document.observe('custom:selectize:changed', function(event) {
        if (event.memo && event.memo.fieldName == data.name && event.memo.trigger && event.findElement() != event.memo.trigger && !event.memo.trigger._silent
            && event.memo.$input) {
          Event.fire(event.memo.$input[0], 'custom:selectize:changed');
          _this.reposition();
        }
      });
      
      // Code of the original Open Pedigree HPO selector control.
      //this._attachFieldEventListeners(hpoPicker, ['custom:selection:changed']);
      this._attachFieldEventListeners(hpoPicker, ['custom:selectize:changed']);
      return result;
    },
    'gene-picker' : function (data) {
      var result = this._generateEmptyField(data);
      var genePicker = new Element('input', {type: 'text', 'class': 'suggest multi suggest-genes', name: data.name});
      result.insert(genePicker);
      genePicker._getValue = function() {
        var results = [];
        if (this.value) {
          var genes = this.value.split(',');
          genes.each(function(item){
            results.push(new Gene(null, item));
          })
        }
        /*
        // Code of the original Open Pedigree gene selector control.
        var container = this.up('.field-box');
        if (container) {
          container.select('input[type=hidden][name=' + data.name + ']').each(function(item){
            results.push(item.next('.value') && item.next('.value').firstChild.nodeValue || item.value);
          });
        }
        */
        return [results];
      }.bind(genePicker);
      // Forward the 'custom:selection:changed' to the input
      var _this = this;
      /*
      // Code of the original Open Pedigree gene selector control.
      document.observe('custom:selection:changed', function(event) {
        if (event.memo && event.memo.fieldName == data.name && event.memo.trigger && event.findElement() != event.memo.trigger && !event.memo.trigger._silent) {
          Event.fire(event.memo.trigger, 'custom:selection:changed');
          _this.reposition();
        }
      });
      */

      document.observe('custom:selectize:changed', function(event) {
        if (event.memo && event.memo.fieldName == data.name && event.memo.trigger && event.findElement() != event.memo.trigger && !event.memo.trigger._silent
            && event.memo.$input) {
          Event.fire(event.memo.$input[0], 'custom:selectize:changed');
          _this.reposition();
        }
      });

      // Code of the original Open Pedigree gene selector control.
      //this._attachFieldEventListeners(genePicker, ['custom:selection:changed']);
      this._attachFieldEventListeners(genePicker, ['custom:selectize:changed']);
      return result;
    },
    'select' : function (data) {
      var result = this._generateEmptyField(data);
      var select = new Element('select', {'name' : data.name});
      result.inputsContainer.insert(select);
      select.wrap('span');
      var _generateSelectOption = function(v) {
        var option = new Element('option', {'value' : v.actual}).update(v.displayed);
        select.insert(option);
      };
      if(data.nullValue) {
        _generateSelectOption({'actual' : '', displayed : '-'});
      }
      if (data.values) {
        data.values.each(_generateSelectOption);
      } else if (data.range) {
        $A($R(data.range.start, data.range.end)).each(function(i) {
          _generateSelectOption({'actual': i, 'displayed' : i + ' ' + data.range.item[+(i!=1)]});
        });
      }
      select._getValue = function() {
        return [(this.selectedIndex >= 0) && this.options[this.selectedIndex].value || ''];
      }.bind(select);
      this._attachFieldEventListeners(select, ['change']);
      return result;
    },
    'hidden' : function (data) {
      var result = this._generateEmptyField(data);
      result.addClassName('hidden');
      var input = new Element('input', {type: 'hidden', name: data.name, value: ''});
      result.update(input);
      return result;
    }
  },

  show : function(node, x, y) {
    // Trigger event to update Gen-O buttons enable/disable status.
    document.fire('pedigree:node:showmenu', { 'node': node });
    this._onscreen = true;
    this.targetNode = node;
    this._setCrtData(node.getSummary());
    this.menuBox.show();
    this.reposition(x, y);
    document.observe('mousedown', this._onClickOutside);
  },

  hide : function() {
    this.hideSuggestPicker();
    this._onscreen = false;
    document.stopObserving('mousedown', this._onClickOutside);
    if (this.targetNode) {
      this.targetNode.onWidgetHide();
      delete this.targetNode;
    }
    this.menuBox.hide();
    this._clearCrtData();
  },

  hideSuggestPicker: function() {
    this.form.select('input.suggest').each(function(item) {
      if (item._suggest) {
        item._suggest.clearSuggestions();
      }
    });
  },

  isVisible: function() {
    return this._onscreen;
  },

  _onClickOutside: function (event) {
    if (!event.findElement('.menu-box') && !event.findElement('.calendar_date_select') && !event.findElement('.suggestItems')) {
      this.hide();
    }
  },

  reposition : function(x, y) {
    x = Math.floor(x);
    if (x !== undefined && isFinite(x)) {
      if (this.canvas && x + this.menuBox.getWidth() > (this.canvas.getWidth() + 10)) {
        var delta = x + this.menuBox.getWidth() - this.canvas.getWidth();
        editor.getWorkspace().panByX(delta, true);
        x -= delta;
      }
      this.menuBox.style.left = x + 'px';
    }

    this.menuBox.style.height = '';
    var height = '';
    var top    = '';
    if (y !== undefined && isFinite(y)) {
      y = Math.floor(y);
    } else {
      if (this.menuBox.style.top.length > 0) {
        y  = parseInt(this.menuBox.style.top.match( /^(\d+)/g )[0]);
      }
      if (y === undefined || !isFinite(y) || y < 0) {
        y = 0;
      }
    }

    // Make sure the menu fits inside the screen
    if (this.canvas && this.menuBox.getHeight() >= (this.canvas.getHeight() - 1)) {
      // menu is too big to fit the screen
      top    = 0;
      height = (this.canvas.getHeight() - 1) + 'px';
    } else if (this.canvas.getHeight() < y + this.menuBox.getHeight() + 1) {
      // menu fits the screen, but have to move it higher for that
      var diff = y + this.menuBox.getHeight() - this.canvas.getHeight() + 1;
      var position = (y - diff);
      if (position < 0) {
        top    = 0;
        height = (this.canvas.getHeight() - 1) + 'px';
      } else {
        top    = position + 'px';
        height = '';
      }
    } else {
      top = y + 'px';
      height = '';
    }

    this.menuBox.style.top      = top;
    this.menuBox.style.height   = height;
    this.menuBox.style.overflow = 'auto';
  },

  _clearCrtData : function () {
    var _this = this;
    Object.keys(this.fieldMap).each(function (name) {
      _this.fieldMap[name].crtValue = _this.fieldMap[name]['default'];
      _this._setFieldValue[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].crtValue);
      _this.fieldMap[name].inactive = false;
    });
  },

  _setCrtData : function (data) {
    var _this = this;
    Object.keys(this.fieldMap).each(function (name) {
      _this.fieldMap[name].crtValue = data && data[name] && typeof(data[name].value) != 'undefined' ? data[name].value : _this.fieldMap[name].crtValue || _this.fieldMap[name]['default'];
      _this.fieldMap[name].inactive = (data && data[name] && (typeof(data[name].inactive) == 'boolean' || typeof(data[name].inactive) == 'object')) ? data[name].inactive : _this.fieldMap[name].inactive;
      _this.fieldMap[name].disabled = (data && data[name] && (typeof(data[name].disabled) == 'boolean' || typeof(data[name].disabled) == 'object')) ? data[name].disabled : _this.fieldMap[name].disabled;
      _this._setFieldValue[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].crtValue);
      _this._setFieldInactive[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].inactive);
      _this._setFieldDisabled[_this.fieldMap[name].type].call(_this, _this.fieldMap[name].element, _this.fieldMap[name].disabled);
    });
  },

  _setFieldValue : {
    'radio' : function (container, value) {
      var target = container.down('input[type=radio][value=' + value + ']');
      if (target) {
        target.checked = true;
      }
    },
    'checkbox' : function (container, value) {
      var checkbox = container.down('input[type=checkbox]');
      if (checkbox) {
        checkbox.checked = value;
      }
    },
    'button' : function (container, value) {
      // This code has some bug and does not set button text (value),
      // but this functionality is currently not needed.
      /*
      var button = container.down('input[type=button]');
      console.log('_setCrtData', button, value)
      if (button) {
        button.value = value;
      }
      */
    },
    'text' : function (container, value) {
      var target = container.down('input[type=text]');
      if (target) {
        target.value = value;
      }
    },
    'textarea' : function (container, value) {
      var target = container.down('textarea');
      if (target) {
        target.value = value;
      }
    },
    /*
    // Original XWiki control was replaced with html input type=date 
    'date-picker' : function (container, value) {
      var target = container.down('input[type=text].xwiki-date');
      if (target) {
        target.value = value && value.toFormattedString({'format_mask' : target.title}) || '';
        target.alt = value && value.toISO8601() || '';
      }
    },
    */
    'date-picker' : function (container, value) {
      var target = container.down('input[type=date]');
      if (target) {
        target.value = value && value.toISO8601().split('T')[0] || '';
      }
    },
    'disease-picker' : function (container, values) {
      var _this = this;
      var target = container.down('input[type=text].suggest-orphanet');
      if (target.selectize){
        if (values.length == 0) {
          target.selectize.clear(true);
        }
        if (values.length > 0) {
          values.each(function(v) {
            var disorder = new Disorder(v.id, v.value);
            target.selectize.addOption({value: disorder.getDisplayName(), id: disorder.getDesanitizedDisorderID(), name: disorder.getName()});
            target.selectize.addItem(disorder.getDisplayName(), true);
            if (editor.getDisorderLegend().getShowColors()) {
              _this._updateDisorderColor(v.id, editor.getDisorderLegend().getObjectColor(v.id));
            }
          });
        }
      }
      /*
      // Code of the original Open Pedigree disorder selector control.
      if (target && target._suggestPicker) {
        target._silent = true;
        target._suggestPicker.clearAcceptedList();
        if (values) {
          values.each(function(v) {
            target._suggestPicker.addItem(v.id, v.value, '');
            _this._updateDisorderColor(v.id, editor.getDisorderLegend().getObjectColor(v.id));
          });
        }
        target._silent = false;
      }
      */
    },
    'hpo-picker' : function (container, values) {
      var _this = this;
      var target = container.down('input[type=text].suggest-hpo');
      if (target.selectize){
        if (values.length == 0) {
          target.selectize.clear(true);
        }
        if (values.length > 0) {
          values.each(function(v) {
            var hpoTerm = new HPOTerm(v.id, v.value);
            target.selectize.addOption({value: hpoTerm.getDisplayName(), id: hpoTerm.getDesanitizedID(), name: hpoTerm.getName()});
            target.selectize.addItem(hpoTerm.getDisplayName(), true);
            if (editor.getHPOLegend().getShowColors()) {
              _this._updateHPOColor(v.id, editor.getHPOLegend().getObjectColor(v.id));
            }
          });
        }
      }
      /*
      // Code of the original Open Pedigree HPO selector control.
      if (target && target._suggestPicker) {
        target._silent = true;
        target._suggestPicker.clearAcceptedList();
        if (values) {
          values.each(function(v) {
            target._suggestPicker.addItem(v.id, v.value, '');
          });
        }
        target._silent = false;
      }
      */
    },
    'gene-picker' : function (container, values) {
      var _this = this;
      var target = container.down('input[type=text].suggest-genes');
      if (target.selectize) {
        if (values.length == 0) {
          target.selectize.clear(true);
        }
        if (values.length > 0) {
          values.each(function(v) {
            var gene = new Gene(null, v);
            // Candidate genes are stored in "{ID} | {Symbol}" (e.g. DisplayName) in person object, 
            // but only symbols are used in gene legend.
            target.selectize.addOption({value: gene.getDisplayName(), id: gene.getID(), name: gene.getSymbol(), group: gene.getGroup()});
            target.selectize.addItem(gene.getDisplayName(), true);
            if (editor.getGeneLegend().getShowColors()) {
              _this._updateGeneColor(gene.getSymbol(), editor.getGeneLegend().getObjectColor(gene.getSymbol()));
            }
          });
        }
      }
      /*
      // Code of the original Open Pedigree gene selector control.
      if (target && target._suggestPicker) {
        target._silent = true;
        target._suggestPicker.clearAcceptedList();
        if (values) {
          values.each(function(v) {
            target._suggestPicker.addItem(v, v, '');
            _this._updateGeneColor(v, editor.getGeneLegend().getObjectColor(v));
          });
        }
        target._silent = false;
      }
      */
    },
    'select' : function (container, value) {
      var target = container.down('select option[value=' + value + ']');
      if (target) {
        target.selected = 'selected';
      }
    },
    'hidden' : function (container, value) {
      var target = container.down('input[type=hidden]');
      if (target) {
        target.value = value;
      }
    }
  },

  _toggleFieldVisibility : function(container, doHide) {
    if (doHide) {
      container.addClassName('hidden');
    } else {
      container.removeClassName('hidden');
    }
  },

  _setFieldInactive : {
    'radio' : function (container, inactive) {
      if (inactive === true) {
        container.addClassName('hidden');
      } else {
        container.removeClassName('hidden');
        container.select('input[type=radio]').each(function(item) {
          if (inactive && Object.prototype.toString.call(inactive) === '[object Array]') {
            item.disabled = (inactive.indexOf(item.value) >= 0);
            if (item.disabled) {
              item.up().addClassName('hidden');
            } else {
              item.up().removeClassName('hidden');
            }
          } else if (!inactive) {
            item.disabled = false;
            item.up().removeClassName('hidden');
          }
        });
      }
    },
    'checkbox' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'button' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'text' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'textarea' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'date-picker' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'disease-picker' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'hpo-picker' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'gene-picker' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'select' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    },
    'hidden' : function (container, inactive) {
      this._toggleFieldVisibility(container, inactive);
    }
  },

  _setFieldDisabled : {
    'radio' : function (container, disabled) {
      if (disabled === true) {
        container.addClassName('hidden');
      } else {
        container.removeClassName('hidden');
        container.select('input[type=radio]').each(function(item) {
          if (disabled && Object.prototype.toString.call(disabled) === '[object Array]') {
            item.disabled = (disabled.indexOf(item.value) >= 0);
          }
          if (!disabled) {
            item.disabled = false;
          }
        });
      }
    },
    'checkbox' : function (container, disabled) {
      var target = container.down('input[type=checkbox]');
      if (target) {
        target.disabled = disabled;
      }
    },
    'text' : function (container, disabled) {
      var target = container.down('input[type=text]');
      if (target) {
        target.disabled = disabled;
      }
    },
    'button' : function (container, disabled) {
      var target = container.down('input[type=button]');
      if (target) {
        target.disabled  = disabled;
      }
    },
    'textarea' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'date-picker' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'disease-picker' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'hpo-picker' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'gene-picker' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'select' : function (container, inactive) {
      // FIXME: Not implemented
    },
    'hidden' : function (container, inactive) {
      // FIXME: Not implemented
    }
  }
});

export default NodeMenu;
