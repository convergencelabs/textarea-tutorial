const username = "User-" + Math.round(Math.random() * 10000);
document.getElementById("username").innerHTML = username;

///////////////////////////////////////////////////////////////////////////////
// Connect and Open the Model
///////////////////////////////////////////////////////////////////////////////

// Connect anonymously using the generated display name
Convergence.connectAnonymously(CONVERGENCE_URL, username).then(domain => {
  return domain.models().openAutoCreate({
    collection: "convergence-tutorials",
    id: "textarea",
    ephemeral: true,
    data: {
      text: DEFAULT_TEXT_DATA
    }
  });
}).then(model => {
  const rts = model.elementAt(["text"]);
  bindTextarea(rts);
  initSharedSelection(rts);
}).catch(error => {
  console.error(error);
});

///////////////////////////////////////////////////////////////////////////////
// Text Editor
///////////////////////////////////////////////////////////////////////////////
const textarea = document.getElementById("textarea");
let textEditor;

// Bind the text area to the real time string
function bindTextarea(rts) {
  // Set the initial data, and set the cursor to the beginning.
  textarea.value = rts.value();
  textarea.selectionStart = 0;
  textarea.selectionEnd = 0;

  // Create the editor utility passing callbacks to bind local events to
  // the RealtimeString.
  textEditor = new HtmlTextCollabExt.CollaborativeTextArea({
    control: textarea,
    onInsert: (index, value) => rts.insert(index, value),
    onDelete: (index, length) => rts.remove(index, length),
    onSelectionChanged: sendLocalSelection
  });

  // Listen to remote events and pass them to the editor utility
  rts.on(Convergence.StringInsertEvent.NAME, (e) => textEditor.insertText(e.index, e.value));
  rts.on(Convergence.StringRemoveEvent.NAME, (e) => textEditor.deleteText(e.index, e.value.length));
}

///////////////////////////////////////////////////////////////////////////////
// Share Selection Functions
///////////////////////////////////////////////////////////////////////////////
const colorAssigner = new ConvergenceColorAssigner.ColorAssigner();

let localSelectionReference;

function initSharedSelection(rts) {
  // Create a local reference that will be used to send the local
  // users selection and cursor.
  localSelectionReference = rts.rangeReference("selection");

  // Set and share the local selection.
  sendLocalSelection();
  localSelectionReference.share();

  // Get all existing "selection" references from the RealTimeString
  // and create remote selection cue for each.
  const references = rts.references({key: "selection"});
  references.forEach((reference) => {
    if (!reference.isLocal()) {
      addRemoteSelection(reference);
    }
  });

  // Listen to the "reference" event which will be fired
  // when a new remote user shares their selection.
  rts.on("reference", (e) => {
    if (e.reference.key() === "selection") {
      addRemoteSelection(e.reference);
    }
  });
}

function sendLocalSelection() {
  const selection = textEditor.selectionManager().getSelection();
  localSelectionReference.set({start: selection.anchor, end: selection.target});
}

function addRemoteSelection(reference) {
  const color = colorAssigner.getColorAsHex(reference.sessionId());
  const remoteRange = reference.value();

  // Gets the text editors SelectionManager.
  const selectionManager = textEditor.selectionManager();

  // Add a new collaborator to the text editor.
  selectionManager.addCollaborator(
      reference.sessionId(),
      reference.user().displayName,
      color,
      {anchor: remoteRange.start, target: remoteRange.end});

  // Monitor the events from the remote reference and update the
  // remote users selection in the SelectionManager.
  reference.on("cleared", () => selectionManager.removeCollaborator(reference.sessionId()) );
  reference.on("disposed", () => selectionManager.removeCollaborator(reference.sessionId()) );
  reference.on("set", (e) => {
    const selection = reference.value();
    const collaborator = selectionManager.getCollaborator(reference.sessionId());
    collaborator.setSelection({anchor: selection.start, target: selection.end});
    if (!e.synthetic) {
      collaborator.flashCursorToolTip(2);
    }
  });
}
