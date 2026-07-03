//
//  Item.swift
//  MaZone
//
//  Created by Adam Yousfi on 2026-06-19.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
