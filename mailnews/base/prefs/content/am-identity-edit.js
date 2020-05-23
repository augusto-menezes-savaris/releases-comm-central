/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from am-addressing.js */
/* import-globals-from am-copies.js */

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { MailServices } = ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
);

var gIdentity = null; // the identity we are editing (may be null for a new identity)
var gAccount = null; // the account the identity is (or will be) associated with

document.addEventListener("dialogaccept", onOk);

function onLoadIdentityProperties() {
  // extract the account
  gIdentity = window.arguments[0].identity;
  gAccount = window.arguments[0].account;
  let prefBundle = document.getElementById("bundle_prefs");

  if (gIdentity) {
    let listName = gIdentity.identityName;
    document.title = prefBundle.getFormattedString("identityDialogTitleEdit", [
      listName,
    ]);
  } else {
    document.title = prefBundle.getString("identityDialogTitleAdd");
  }

  loadSMTPServerList();

  initIdentityValues(gIdentity);
  initCopiesAndFolder(gIdentity);
  initCompositionAndAddressing(gIdentity);
}

// based on the values of gIdentity, initialize the identity fields we expose to the user
function initIdentityValues(identity) {
  function initSmtpServer(aServerKey) {
    // Select a server in the SMTP server menulist by its key.
    // The value of the identity.smtpServerKey is null when the
    // "use default server" option is used so, if we get that passed in, select
    // the useDefaultItem representing this option by using the value of "".
    document.getElementById("identity.smtpServerKey").value = aServerKey || "";
  }

  if (identity) {
    document.getElementById("identity.fullName").value = identity.fullName;
    document.getElementById("identity.email").value = identity.email;
    document.getElementById("identity.replyTo").value = identity.replyTo;
    document.getElementById("identity.organization").value =
      identity.organization;
    document.getElementById("identity.attachSignature").checked =
      identity.attachSignature;
    document.getElementById("identity.htmlSigText").value =
      identity.htmlSigText;
    document.getElementById("identityHtmlSigFormat").checked =
      identityHtmlSigFormat;

    if (identity.signature) {
      document.getElementById("identity.signature").value =
        identity.signature.path;
    }

    document.getElementById("identity.attachVCard").checked =
      identity.attachVCard;
    document.getElementById("identity.escapedVCard").value =
      identity.escapedVCard;
    initSmtpServer(identity.smtpServerKey);

    // This field does not exist for the default identity shown in the am-main.xhtml pane.
    let idLabel = document.getElementById("identity.label");
    if (idLabel) {
      idLabel.value = identity.label;
    }
  } else {
    // We're adding an identity, use the best default we have.
    initSmtpServer(gAccount.defaultIdentity.smtpServerKey);
  }

  setupSignatureItems();
}

function initCopiesAndFolder(identity) {
  // if we are editing an existing identity, use it...otherwise copy our values from the default identity
  var copiesAndFoldersIdentity = identity ? identity : gAccount.defaultIdentity;

  document.getElementById("identity.fccFolder").value =
    copiesAndFoldersIdentity.fccFolder;
  document.getElementById("identity.draftFolder").value =
    copiesAndFoldersIdentity.draftFolder;
  document.getElementById("identity.archiveFolder").value =
    copiesAndFoldersIdentity.archiveFolder;
  document.getElementById("identity.stationeryFolder").value =
    copiesAndFoldersIdentity.stationeryFolder;

  document.getElementById(
    "identity.fccFolderPickerMode"
  ).value = copiesAndFoldersIdentity.fccFolderPickerMode
    ? copiesAndFoldersIdentity.fccFolderPickerMode
    : 0;
  document.getElementById(
    "identity.draftsFolderPickerMode"
  ).value = copiesAndFoldersIdentity.draftsFolderPickerMode
    ? copiesAndFoldersIdentity.draftsFolderPickerMode
    : 0;
  document.getElementById(
    "identity.archivesFolderPickerMode"
  ).value = copiesAndFoldersIdentity.archivesFolderPickerMode
    ? copiesAndFoldersIdentity.archivesFolderPickerMode
    : 0;
  document.getElementById(
    "identity.tmplFolderPickerMode"
  ).value = copiesAndFoldersIdentity.tmplFolderPickerMode
    ? copiesAndFoldersIdentity.tmplFolderPickerMode
    : 0;

  document.getElementById("identity.doCc").checked =
    copiesAndFoldersIdentity.doCc;
  document.getElementById("identity.doCcList").value =
    copiesAndFoldersIdentity.doCcList;
  document.getElementById("identity.doBcc").checked =
    copiesAndFoldersIdentity.doBcc;
  document.getElementById("identity.doBccList").value =
    copiesAndFoldersIdentity.doBccList;
  document.getElementById("identity.doFcc").checked =
    copiesAndFoldersIdentity.doFcc;
  document.getElementById("identity.fccReplyFollowsParent").checked =
    copiesAndFoldersIdentity.fccReplyFollowsParent;
  document.getElementById("identity.showSaveMsgDlg").checked =
    copiesAndFoldersIdentity.showSaveMsgDlg;
  document.getElementById("identity.archiveEnabled").checked =
    copiesAndFoldersIdentity.archiveEnabled;

  onInitCopiesAndFolders(); // am-copies.js method
}

function initCompositionAndAddressing(identity) {
  // if we are editing an existing identity, use it...otherwise copy our values from the default identity
  var addressingIdentity = identity ? identity : gAccount.defaultIdentity;

  document.getElementById("identity.directoryServer").value =
    addressingIdentity.directoryServer;
  document.getElementById("identity.overrideGlobal_Pref").value =
    addressingIdentity.overrideGlobalPref;
  let autoCompleteElement = document.getElementById(
    "identity.autocompleteToMyDomain"
  );
  if (autoCompleteElement) {
    // Thunderbird does not have this element.
    autoCompleteElement.checked = addressingIdentity.autocompleteToMyDomain;
  }

  document.getElementById("identity.composeHtml").checked =
    addressingIdentity.composeHtml;
  document.getElementById("identity.autoQuote").checked =
    addressingIdentity.autoQuote;
  document.getElementById("identity.replyOnTop").value =
    addressingIdentity.replyOnTop;
  document.getElementById("identity.sig_bottom").value =
    addressingIdentity.sigBottom;
  document.getElementById("identity.sig_on_reply").checked =
    addressingIdentity.sigOnReply;
  document.getElementById("identity.sig_on_fwd").checked =
    addressingIdentity.sigOnForward;

  onInitCompositionAndAddressing(); // am-addressing.js method
}

function onOk(event) {
  if (!validEmailAddress()) {
    event.preventDefault();
    return;
  }

  // if we are adding a new identity, create an identity, set the fields and add it to the
  // account.
  if (!gIdentity) {
    // ask the account manager to create a new identity for us
    gIdentity = MailServices.accounts.createIdentity();

    // copy in the default identity settings so we inherit lots of stuff like the default drafts folder, etc.
    gIdentity.copy(gAccount.defaultIdentity);

    // assume the identity is valid by default?
    gIdentity.valid = true;

    // add the identity to the account
    gAccount.addIdentity(gIdentity);

    // now fall through to saveFields which will save our new values
  }

  // if we are modifying an existing identity, save the fields
  saveIdentitySettings(gIdentity);
  saveCopiesAndFolderSettings(gIdentity);
  saveAddressingAndCompositionSettings(gIdentity);

  window.arguments[0].result = true;
  window.dispatchEvent(new CustomEvent("prefchange"));
}

// returns false and prompts the user if
// the identity does not have an email address
function validEmailAddress() {
  var emailAddress = document.getElementById("identity.email").value;

  // quickly test for an @ sign to test for an email address. We don't have
  // to be anymore precise than that.
  if (!emailAddress.includes("@")) {
    // alert user about an invalid email address

    var prefBundle = document.getElementById("bundle_prefs");

    Services.prompt.alert(
      window,
      prefBundle.getString("identity-edit-req-title"),
      prefBundle.getString("identity-edit-req")
    );
    return false;
  }

  return true;
}

function saveIdentitySettings(identity) {
  if (identity) {
    let idLabel = document.getElementById("identity.label");
    if (idLabel) {
      identity.label = idLabel.value;
    }
    identity.fullName = document.getElementById("identity.fullName").value;
    identity.email = document.getElementById("identity.email").value;
    identity.replyTo = document.getElementById("identity.replyTo").value;
    identity.organization = document.getElementById(
      "identity.organization"
    ).value;
    identity.attachSignature = document.getElementById(
      "identity.attachSignature"
    ).checked;
    identity.htmlSigText = document.getElementById(
      "identity.htmlSigText"
    ).value;
    identityHtmlSigFormat = document.getElementById(
      "identityHtmlSigFormat"
    ).checked;

    identity.attachVCard = document.getElementById(
      "identity.attachVCard"
    ).checked;
    identity.escapedVCard = document.getElementById(
      "identity.escapedVCard"
    ).value;
    identity.smtpServerKey = document.getElementById(
      "identity.smtpServerKey"
    ).value;

    let attachSignaturePath = document.getElementById("identity.signature")
      .value;
    identity.signature = null; // this is important so we don't accidentally inherit the default

    if (attachSignaturePath) {
      // convert signature path back into a nsIFile
      var sfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      sfile.initWithPath(attachSignaturePath);
      if (sfile.exists()) {
        identity.signature = sfile;
      }
    }
  }
}

function saveCopiesAndFolderSettings(identity) {
  onSaveCopiesAndFolders(); // am-copies.js routine

  identity.fccFolder = document.getElementById("identity.fccFolder").value;
  identity.draftFolder = document.getElementById("identity.draftFolder").value;
  identity.archiveFolder = document.getElementById(
    "identity.archiveFolder"
  ).value;
  identity.stationeryFolder = document.getElementById(
    "identity.stationeryFolder"
  ).value;
  identity.fccFolderPickerMode = document.getElementById(
    "identity.fccFolderPickerMode"
  ).value;
  identity.draftsFolderPickerMode = document.getElementById(
    "identity.draftsFolderPickerMode"
  ).value;
  identity.archivesFolderPickerMode = document.getElementById(
    "identity.archivesFolderPickerMode"
  ).value;
  identity.tmplFolderPickerMode = document.getElementById(
    "identity.tmplFolderPickerMode"
  ).value;
  identity.doCc = document.getElementById("identity.doCc").checked;
  identity.doCcList = document.getElementById("identity.doCcList").value;
  identity.doBcc = document.getElementById("identity.doBcc").checked;
  identity.doBccList = document.getElementById("identity.doBccList").value;
  identity.doFcc = document.getElementById("identity.doFcc").checked;
  identity.fccReplyFollowsParent = document.getElementById(
    "identity.fccReplyFollowsParent"
  ).checked;
  identity.showSaveMsgDlg = document.getElementById(
    "identity.showSaveMsgDlg"
  ).checked;
  identity.archiveEnabled = document.getElementById(
    "identity.archiveEnabled"
  ).checked;
}

function saveAddressingAndCompositionSettings(identity) {
  identity.directoryServer = document.getElementById(
    "identity.directoryServer"
  ).value;
  identity.overrideGlobalPref =
    document.getElementById("identity.overrideGlobal_Pref").value == "true";
  let autoCompleteElement = document.getElementById(
    "identity.autocompleteToMyDomain"
  );
  if (autoCompleteElement) {
    // Thunderbird does not have this element.
    identity.autocompleteToMyDomain = autoCompleteElement.checked;
  }
  identity.composeHtml = document.getElementById(
    "identity.composeHtml"
  ).checked;
  identity.autoQuote = document.getElementById("identity.autoQuote").checked;
  identity.replyOnTop = document.getElementById("identity.replyOnTop").value;
  identity.sigBottom =
    document.getElementById("identity.sig_bottom").value == "true";
  identity.sigOnReply = document.getElementById(
    "identity.sig_on_reply"
  ).checked;
  identity.sigOnForward = document.getElementById(
    "identity.sig_on_fwd"
  ).checked;
}

function selectFile() {
  const nsIFilePicker = Ci.nsIFilePicker;

  var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

  var prefBundle = document.getElementById("bundle_prefs");
  var title = prefBundle.getString("choosefile");
  fp.init(window, title, nsIFilePicker.modeOpen);
  fp.appendFilters(nsIFilePicker.filterAll);

  // Get current signature folder, if there is one.
  // We can set that to be the initial folder so that users
  // can maintain their signatures better.
  var sigFolder = GetSigFolder();
  if (sigFolder) {
    fp.displayDirectory = sigFolder;
  }

  fp.open(rv => {
    if (rv != nsIFilePicker.returnOK || !fp.file) {
      return;
    }
    document.getElementById("identity.signature").value = fp.file.path;
  });
}

function GetSigFolder() {
  var sigFolder = null;
  try {
    var account = parent.getCurrentAccount();
    var identity = account.defaultIdentity;
    var signatureFile = identity.signature;

    if (signatureFile) {
      signatureFile = signatureFile.QueryInterface(Ci.nsIFile);
      sigFolder = signatureFile.parent;

      if (!sigFolder.exists()) {
        sigFolder = null;
      }
    }
  } catch (ex) {
    dump("failed to get signature folder..\n");
  }
  return sigFolder;
}

// Signature textbox is active unless option to select from file is checked.
// If a signature is need to be attached, the associated items which
// displays the absolute path to the signature (in a textbox) and the way
// to select a new signature file (a button) are enabled. Otherwise, they
// are disabled. Check to see if the attachSignature is locked to block
// broadcasting events.
function setupSignatureItems() {
  var signature = document.getElementById("identity.signature");
  var browse = document.getElementById("identity.sigbrowsebutton");
  var htmlSigText = document.getElementById("identity.htmlSigText");
  var htmlSigFormat = document.getElementById("identityHtmlSigFormat");
  var attachSignature = document.getElementById("identity.attachSignature");
  var checked = attachSignature.checked;

  if (checked) {
    htmlSigText.setAttribute("disabled", "disabled");
    htmlSigFormat.setAttribute("disabled", "true");
  } else {
    htmlSigText.removeAttribute("disabled");
    htmlSigFormat.removeAttribute("disabled");
  }

  if (checked && !getAccountValueIsLocked(signature)) {
    signature.removeAttribute("disabled");
  } else {
    signature.setAttribute("disabled", "disabled");
  }

  if (checked && !getAccountValueIsLocked(browse)) {
    browse.removeAttribute("disabled");
  } else {
    browse.setAttribute("disabled", "true");
  }
}

function editVCardCallback(escapedVCardStr) {
  var escapedVCard = document.getElementById("identity.escapedVCard");
  escapedVCard.value = escapedVCardStr;
}

function editVCard() {
  var escapedVCard = document.getElementById("identity.escapedVCard");
  let args = {
    escapedVCardStr: escapedVCard.value,
    okCallback: editVCardCallback,
    titleProperty: "editVCardTitle",
    hideABPicker: true,
  };

  // read vCard hidden value from UI
  parent.gSubDialog.open(
    "chrome://messenger/content/addressbook/abNewCardDialog.xhtml",
    "resizable=no",
    args
  );
}

function getAccountForFolderPickerState() {
  return gAccount;
}

/**
 * Build the SMTP server list for display.
 */
function loadSMTPServerList() {
  var smtpServerList = document.getElementById("identity.smtpServerKey");
  let defaultServer = MailServices.smtp.defaultServer;
  let currentValue = smtpServerList.value;

  var smtpPopup = smtpServerList.menupopup;
  while (smtpPopup.lastChild.nodeName != "menuseparator") {
    smtpPopup.lastChild.remove();
  }

  for (let server of MailServices.smtp.servers) {
    if (server instanceof Ci.nsISmtpServer) {
      var serverName = "";
      if (server.description) {
        serverName = server.description + " - ";
      } else if (server.username) {
        serverName = server.username + " - ";
      }
      serverName += server.hostname;

      if (defaultServer.key == server.key) {
        serverName +=
          " " +
          document
            .getElementById("bundle_messenger")
            .getString("defaultServerTag");
      }

      smtpServerList.appendItem(serverName, server.key);
    }
  }

  smtpServerList.value = currentValue;
}

/**
 * Open dialog for editing properties of currently selected SMTP server.
 */
function editCurrentSMTP() {
  let smtpKey = document.getElementById("identity.smtpServerKey").value;
  let server =
    smtpKey === ""
      ? MailServices.smtp.defaultServer
      : MailServices.smtp.getServerByKey(smtpKey);
  let args = { server, result: false, addSmtpServer: "" };

  parent.gSubDialog.open(
    "chrome://messenger/content/SmtpServerEdit.xhtml",
    null,
    args,
    loadSMTPServerList
  );
}
