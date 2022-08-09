import { Address, ipfs, json } from "@graphprotocol/graph-ts";
import {
  Web3RSVP,
  ConfirmedAttendee,
  DepositsPaidOut,
  NewEventCreated,
  NewRSVP
} from "../generated/Web3RSVP/Web3RSVP"
import { Event, Account, RSVP, Confirmation } from "../generated/schema"
import { integer } from "@protofire/subgraph-toolkit";

/*
event NewEventCreated(
  bytes32 eventID,
  address creatorAddress,
  uint256 eventTimestamp,
  uint256 maxCapacity,
  uint256 deposit,
  string eventDataCID
);

event NewRSVP(
  bytes32 eventID, 
  address attendeeAddress
);

event ConfirmedAttendee(
  bytes32 eventID, a
  ddress attendeeAddress
);

event DepositsPaidOut(
  bytes32 eventID
);

*/

/*

type Event @entity {
  id: ID!
  eventID: Bytes!
  name: String
  description: String
  link: String
  imageURL: String
  eventOwner: Bytes!
  eventTimestamp: BigInt!
  maxCapacity: BigInt!
  deposit: BigInt!
  paidOut: Boolean!
  totalRSVPs: BigInt!
  totalConfirmedAttendees: BigInt!
  rsvps: [RSVP!] @derivedFrom(field: "event")
  confirmedAttendees: [Confirmation!] @derivedFrom(field: "event")
}

type Account @entity {
  id: ID!
  totalRSVPs: BigInt!
  totalAttendedEvents: BigInt!
  rsvps: [RSVP!] @derivedFrom(field: "attendee")
  attendedEvents: [Confirmation!] @derivedFrom(field: "attendee")
}

type RSVP @entity {
  id: ID!
  attendee: Account!
  event: Event!
}

type Confirmation @entity {
  id: ID!
  attendee: Account!
  event: Event!
}

*/

export function handleNewEventCreated(event: NewEventCreated): void {
  let newEvent = Event.load(event.params.eventID.toHex());
  if (newEvent == null) { // only load if null
    newEvent = new Event(event.params.eventID.toHex());
    newEvent.eventID = event.params.eventID;
    newEvent.eventOwner = event.params.creatorAddress;
    newEvent.eventTimestamp = event.params.eventTimestamp;
    newEvent.maxCapacity = event.params.maxCapacity;
    newEvent.deposit = event.params.deposit;
    newEvent.paidOut = false;
    newEvent.totalRSVPs = integer.ZERO;
    newEvent.totalConfirmedAttendees = integer.ZERO;
    let metadata = ipfs.cat(event.params.eventDataCID + "/data.json");

    if (metadata) {
      const value = json.fromBytes(metadata).toObject();
      if (value) {
        const name = value.get("name");
        const description = value.get("description");
        const link = value.get("link");
        const imagePath = value.get("image");

        if (name) {
          newEvent.name = name.toString();
        }

        if (description) {
          newEvent.description = description.toString();
        }

        if (link) {
          newEvent.link = link.toString();
        }

        if (imagePath) {
          const imageURL =
            "https://ipfs.io/ipfs/" +
            event.params.eventDataCID +
            imagePath.toString();
          newEvent.imageURL = imageURL;
        } else {
          // return fallback image if no imagePath
          const fallbackURL =
            "https://ipfs.io/ipfs/bafybeibssbrlptcefbqfh4vpw2wlmqfj2kgxt3nil4yujxbmdznau3t5wi/event.png";
          newEvent.imageURL = fallbackURL;
        }
      }
    }
    newEvent.save();
  }
}

function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address.toHex());
  if (account == null) {
    account = new Account(address.toHex());
    account.totalRSVPs = integer.ZERO;
    account.totalAttendedEvents = integer.ZERO;
    account.save();
  }
  return account;
}

export function handleNewRSVP(event: NewRSVP): void {
  let newRSVP = RSVP.load(event.transaction.from.toHex());
  let account = getOrCreateAccount(event.params.attendeeAddress);
  let thisEvent = Event.load(event.params.eventID.toHex());
  if (newRSVP == null && thisEvent != null) {
    newRSVP = new RSVP(event.transaction.from.toHex());
    newRSVP.attendee = account.id;
    newRSVP.event = thisEvent.id;
    newRSVP.save();
    account.totalRSVPs = integer.increment(account.totalRSVPs);
    account.save();
  }
}

export function handleConfirmedAttendee(event: ConfirmedAttendee): void {
  let id = event.params.eventID.toHex() + event.params.attendeeAddress.toHex();
  let newConfirmation = Confirmation.load(id);
  let account = getOrCreateAccount(event.params.attendeeAddress);
  let thisEvent = Event.load(event.params.eventID.toHex());
  if (newConfirmation == null && thisEvent != null) {
    newConfirmation = new Confirmation(id);
    newConfirmation.attendee = account.id;
    newConfirmation.event = thisEvent.id;
    newConfirmation.save();

    thisEvent.totalConfirmedAttendees = integer.increment(
      thisEvent.totalConfirmedAttendees
    );
    thisEvent.save();

    account.totalAttendedEvents = integer.increment(
      account.totalAttendedEvents
    );
    account.save();
  }
}

export function handleDepositsPaidOut(event: DepositsPaidOut): void {
  let thisEvent = Event.load(event.params.eventID.toHex());
  if (thisEvent) {
    thisEvent.paidOut = true;
    thisEvent.save();
  }
}