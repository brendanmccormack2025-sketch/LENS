import IdentityLookup

/// LENS Text Filter — iOS hands us texts from unknown senders (never contacts, never iMessage).
/// We score them on-device with ScamRules and send likely scams to the Junk folder.
/// Nothing is sent anywhere: no network URL is configured, so there is no deferral.
final class MessageFilterExtension: ILMessageFilterExtension {}

extension MessageFilterExtension: ILMessageFilterQueryHandling {
    func handle(
        _ queryRequest: ILMessageFilterQueryRequest,
        context: ILMessageFilterExtensionContext,
        completion: @escaping (ILMessageFilterQueryResponse) -> Void
    ) {
        let verdict = ScamRules.score(sender: queryRequest.sender, body: queryRequest.messageBody)
        let response = ILMessageFilterQueryResponse()
        response.action = verdict.isScam ? .junk : .allow
        completion(response)
    }
}
