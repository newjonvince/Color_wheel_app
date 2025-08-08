import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/api';

const { width: screenWidth } = Dimensions.get('window');

export default function CommunityModal({ visible, onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('suggested');
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCommunityData();
    }
  }, [visible, activeTab]);

  const loadCommunityData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'suggested') {
        const response = await ApiService.get('/users/suggested');
        setSuggestedUsers(response.data || []);
      } else if (activeTab === 'following') {
        const response = await ApiService.get('/users/following');
        setFollowing(response.data || []);
      } else if (activeTab === 'followers') {
        const response = await ApiService.get('/users/followers');
        setFollowers(response.data || []);
      }
    } catch (error) {
      console.error('Error loading community data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUser = async (userId) => {
    try {
      await ApiService.post(`/users/${userId}/follow`);
      
      // Update suggested users list
      setSuggestedUsers(suggestedUsers.map(user => 
        user.id === userId 
          ? { ...user, is_following: true }
          : user
      ));
      
      Alert.alert('Success', 'User followed successfully');
    } catch (error) {
      console.error('Error following user:', error);
      Alert.alert('Error', 'Failed to follow user');
    }
  };

  const handleUnfollowUser = async (userId) => {
    try {
      await ApiService.delete(`/users/${userId}/follow`);
      
      // Update following list
      setFollowing(following.filter(user => user.id !== userId));
      
      Alert.alert('Success', 'User unfollowed successfully');
    } catch (error) {
      console.error('Error unfollowing user:', error);
      Alert.alert('Error', 'Failed to unfollow user');
    }
  };

  const handleSyncContacts = () => {
    Alert.alert(
      'Sync Contacts',
      'This feature would sync your contacts to find friends on the platform.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sync', onPress: () => console.log('Sync contacts') }
      ]
    );
  };

  const handleSyncFacebook = () => {
    Alert.alert(
      'Sync Facebook',
      'This feature would connect to Facebook to find friends.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sync', onPress: () => console.log('Sync Facebook') }
      ]
    );
  };

  const handleInviteFriends = () => {
    Alert.alert(
      'Invite Friends',
      'This feature would allow you to invite friends to join the platform.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Invites', onPress: () => console.log('Invite friends') }
      ]
    );
  };

  const renderSuggestedUser = (user) => (
    <View key={user.id} style={styles.userCard}>
      <TouchableOpacity style={styles.closeButton}>
        <Ionicons name="close" size={20} color="#9CA3AF" />
      </TouchableOpacity>
      
      <View style={styles.userContent}>
        <Text style={styles.suggestedLabel}>Suggested for you</Text>
        
        <View style={styles.userAvatar}>
          <Text style={styles.avatarText}>
            {user.username?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        
        <Text style={styles.username}>fit</Text>
        <Text style={styles.userHandle}>@{user.username || 'user'}</Text>
        
        {/* Sample user items */}
        <View style={styles.userItems}>
          <Image 
            source={{ uri: 'https://via.placeholder.com/60x60/333/fff?text=👕' }} 
            style={styles.itemImage} 
          />
          <Image 
            source={{ uri: 'https://via.placeholder.com/60x60/666/fff?text=🧢' }} 
            style={styles.itemImage} 
          />
          <Image 
            source={{ uri: 'https://via.placeholder.com/60x60/999/fff?text=👔' }} 
            style={styles.itemImage} 
          />
          <Image 
            source={{ uri: 'https://via.placeholder.com/60x60/4A90E2/fff?text=👖' }} 
            style={styles.itemImage} 
          />
        </View>
        
        <TouchableOpacity
          style={styles.followButton}
          onPress={() => handleFollowUser(user.id)}
        >
          <Text style={styles.followButtonText}>Follow</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFollowingUser = (user) => (
    <View key={user.id} style={styles.followingUserItem}>
      <View style={styles.userInfo}>
        <View style={styles.smallAvatar}>
          <Text style={styles.smallAvatarText}>
            {user.username?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.followingUsername}>{user.username}</Text>
          <Text style={styles.followingUserHandle}>@{user.username}</Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.unfollowButton}
        onPress={() => handleUnfollowUser(user.id)}
      >
        <Text style={styles.unfollowButtonText}>Following</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFollowerUser = (user) => (
    <View key={user.id} style={styles.followingUserItem}>
      <View style={styles.userInfo}>
        <View style={styles.smallAvatar}>
          <Text style={styles.smallAvatarText}>
            {user.username?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.followingUsername}>{user.username}</Text>
          <Text style={styles.followingUserHandle}>@{user.username}</Text>
        </View>
      </View>
      
      {!user.is_following && (
        <TouchableOpacity
          style={styles.followBackButton}
          onPress={() => handleFollowUser(user.id)}
        >
          <Text style={styles.followBackButtonText}>Follow Back</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>My community</Text>
          
          <TouchableOpacity style={styles.profileIcon}>
            <Ionicons name="person-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'suggested' && styles.activeTab]}
            onPress={() => setActiveTab('suggested')}
          >
            <Text style={[styles.tabText, activeTab === 'suggested' && styles.activeTabText]}>
              Suggested
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'following' && styles.activeTab]}
            onPress={() => setActiveTab('following')}
          >
            <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>
              {following.length} Following
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'followers' && styles.activeTab]}
            onPress={() => setActiveTab('followers')}
          >
            <Text style={[styles.tabText, activeTab === 'followers' && styles.activeTabText]}>
              {followers.length} Followers
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'suggested' && (
            <>
              <Text style={styles.sectionTitle}>Suggested for you</Text>
              
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.suggestedScroll}
              >
                {suggestedUsers.map(renderSuggestedUser)}
              </ScrollView>
              
              <View style={styles.findPeopleSection}>
                <Text style={styles.findPeopleTitle}>Find people you know</Text>
                
                <TouchableOpacity style={styles.findPeopleItem} onPress={handleSyncContacts}>
                  <View style={styles.findPeopleIcon}>
                    <Ionicons name="person-add" size={24} color="#1F2937" />
                  </View>
                  <View style={styles.findPeopleContent}>
                    <Text style={styles.findPeopleLabel}>Contacts</Text>
                    <Text style={styles.findPeopleDescription}>Find friends from contacts</Text>
                  </View>
                  <Text style={styles.syncButton}>Sync</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.findPeopleItem} onPress={handleSyncFacebook}>
                  <View style={[styles.findPeopleIcon, styles.facebookIcon]}>
                    <Ionicons name="logo-facebook" size={24} color="#1877F2" />
                  </View>
                  <View style={styles.findPeopleContent}>
                    <Text style={styles.findPeopleLabel}>Facebook Friends</Text>
                    <Text style={styles.findPeopleDescription}>Find friends from Facebook</Text>
                  </View>
                  <Text style={styles.syncButton}>Sync</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.findPeopleItem} onPress={handleInviteFriends}>
                  <View style={styles.findPeopleIcon}>
                    <Ionicons name="person-add" size={24} color="#1F2937" />
                  </View>
                  <View style={styles.findPeopleContent}>
                    <Text style={styles.findPeopleLabel}>Invite friends</Text>
                    <Text style={styles.findPeopleDescription}>Share your profile to connect</Text>
                  </View>
                  <Text style={styles.sendButton}>Send</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          
          {activeTab === 'following' && (
            <View style={styles.followingList}>
              {following.map(renderFollowingUser)}
              {following.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>You're not following anyone yet</Text>
                </View>
              )}
            </View>
          )}
          
          {activeTab === 'followers' && (
            <View style={styles.followingList}>
              {followers.map(renderFollowerUser)}
              {followers.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No followers yet</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeIcon: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  profileIcon: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1F2937',
  },
  tabText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  suggestedScroll: {
    paddingLeft: 16,
  },
  userCard: {
    width: 200,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginRight: 12,
    padding: 16,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  userContent: {
    alignItems: 'center',
  },
  suggestedLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  userItems: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  itemImage: {
    width: 30,
    height: 30,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  followButton: {
    backgroundColor: '#BFFF00',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  findPeopleSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  findPeopleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  findPeopleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  findPeopleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  facebookIcon: {
    backgroundColor: '#E3F2FD',
  },
  findPeopleContent: {
    flex: 1,
  },
  findPeopleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  findPeopleDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  syncButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  sendButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  followingList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  followingUserItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  smallAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  followingUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  followingUserHandle: {
    fontSize: 12,
    color: '#6B7280',
  },
  unfollowButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  unfollowButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  followBackButton: {
    backgroundColor: '#BFFF00',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  followBackButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});
