import {ObservableValue} from '../base/Obs.js';

const imageEditorVisible = new ObservableValue(false);
const obsImageEditorShowing = imageEditorVisible.observable().whenDifferent();
function openImageEditor() { imageEditorVisible.set(true); }
function closeImageEditor() { imageEditorVisible.set(false); }

export {openImageEditor, closeImageEditor, obsImageEditorShowing};
