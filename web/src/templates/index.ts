import {basicTemplates} from './basic';
import {specialTemplates} from './special';
import {treeTemplates} from './tree';
import {ordinationTemplates} from './ordination';
const priority=['bar-grouped','scatter','line','heatmap','box','pie'];
export const templates=[...basicTemplates,...specialTemplates,...ordinationTemplates,...treeTemplates].sort((a,b)=>(priority.includes(a.id)?priority.indexOf(a.id):99)-(priority.includes(b.id)?priority.indexOf(b.id):99));

import { improveScientificExamples } from './scientificExamples';
improveScientificExamples(templates);
import { applyPublicationDefaults } from './publicationDefaults';
applyPublicationDefaults(templates);

// The magnetic example retains its explicit reconstruction provenance and scientific defaults.
import { magneticTemplates } from './magnetic';
templates.push(...magneticTemplates);
