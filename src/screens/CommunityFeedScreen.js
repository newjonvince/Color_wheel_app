import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/api';
import CommunityModal from '../components/CommunityModal';

const { width: screenWidth } = Dimensions.get('window');

export default function CommunityFeedScreen({ navigation, currentUser, onLogout }) {
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCommunityModal, setShowCommunityModal] = useState(false);

  useEffect(() => {
    loadCommunityPosts();
  }, []);

  const loadCommunityPosts = async () => {
    try {
      setLoading(true);
      // Load public posts from all users
      const response = await ApiService.get('/posts/community');
      setPosts(response.data || []);
    } catch (error) {
      console.error('Error loading community posts:', error);
      Alert.alert('Error', 'Failed to load community posts');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCommunityPosts();
    setRefreshing(false);
  };

  const handleFollowUser = async (userId) => {
    try {
      await ApiService.post(`/users/${userId}/follow`);
      // Update posts to reflect follow status
      setPosts(posts.map(post => 
        post.user_id === userId 
          ? { ...post, is_following: true }
          : post
      ));
    } catch (error) {
      console.error('Error following user:', error);
      Alert.alert('Error', 'Failed to follow user');
    }
  };

  const handleUnfollowUser = async (userId) => {
    try {
      await ApiService.delete(`/users/${userId}/follow`);
      // Update posts to reflect unfollow status
      setPosts(posts.map(post => 
        post.user_id === userId 
          ? { ...post, is_following: false }
          : post
      ));
    } catch (error) {
      console.error('Error unfollowing user:', error);
      Alert.alert('Error', 'Failed to unfollow user');
    }
  };

  const handleLikePost = async (postId) => {
    try {
      await ApiService.post(`/posts/${postId}/like`);
      // Update posts to reflect like status
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, is_liked: !post.is_liked, likes_count: post.is_liked ? post.likes_count - 1 : post.likes_count + 1 }
          : post
      ));
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const renderPost = (post) => (
    <View key={post.id} style={styles.postCard}>
      {/* User Header */}
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {post.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.username}>Styled by {post.username}</Text>
            <Text style={styles.suggestion}>suggested for you</Text>
          </View>
        </View>
        
        {post.user_id !== currentUser?.id && (
          <TouchableOpacity
            style={[styles.followButton, post.is_following && styles.followingButton]}
            onPress={() => post.is_following ? handleUnfollowUser(post.user_id) : handleFollowUser(post.user_id)}
          >
            <Text style={[styles.followButtonText, post.is_following && styles.followingButtonText]}>
              {post.is_following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Post Content */}
      {post.image_url && (
        <Image source={{ uri: post.image_url }} style={styles.postImage} />
      )}
      
      {/* Color Palette */}
      {post.colors && post.colors.length > 0 && (
        <View style={styles.colorPalette}>
          {post.colors.map((color, index) => (
            <View
              key={index}
              style={[styles.colorSwatch, { backgroundColor: color }]}
            />
          ))}
        </View>
      )}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLikePost(post.id)}
        >
          <Ionicons
            name={post.is_liked ? "heart" : "heart-outline"}
            size={24}
            color={post.is_liked ? "#ff3040" : "#666"}
          />
          <Text style={styles.actionText}>{post.likes_count || 0}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={24} color="#666" />
          <Text style={styles.actionText}>{post.comments_count || 0}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={24} color="#666" />
        </TouchableOpacity>
        
        <View style={styles.spacer} />
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.tapToReact}>👏 Tap to react</Text>
        </TouchableOpacity>
      </View>

      {/* Post Description */}
      {post.description && (
        <Text style={styles.postDescription}>{post.description}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.profileCircle}>
            <Text style={styles.profileInitial}>
              {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
            <View style={styles.percentageBadge}>
              <Text style={styles.percentageText}>15%</Text>
            </View>
          </View>
          <Text style={styles.greeting}>Hey, {currentUser?.username || 'User'}!</Text>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="refresh-outline" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="notifications-outline" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerIcon}
            onPress={() => setShowCommunityModal(true)}
          >
            <Ionicons name="person-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Icons */}
      <View style={styles.navIcons}>
        <TouchableOpacity 
          style={styles.navIcon}
          onPress={() => navigation.navigate('Upload')}
        >
          <View style={styles.uploadIcon}>
            <Ionicons name="cloud-upload" size={24} color="#fff" />
          </View>
          <Text style={styles.navText}>Upload</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navIcon}
          onPress={() => navigation.navigate('ColorWheel')}
        >
          <View style={styles.wheelIcon}>
            <Ionicons name="color-palette" size={24} color="#8B5CF6" />
          </View>
          <Text style={styles.navText}>Wheel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navIcon}>
          <View style={styles.planIcon}>
            <Ionicons name="calendar" size={24} color="#10B981" />
          </View>
          <Text style={styles.navText}>Plan</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navIcon}>
          <View style={styles.reviewIcon}>
            <Ionicons name="bar-chart" size={24} color="#F59E0B" />
          </View>
          <Text style={styles.navText}>Review</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navIcon}>
          <View style={styles.readIcon}>
            <Ionicons name="document-text" size={24} color="#6B7280" />
          </View>
          <Text style={styles.navText}>Read</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        <TouchableOpacity style={[styles.tab, styles.activeTab]}>
          <Text style={[styles.tabText, styles.activeTabText]}>For You</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabText}>Outfit Selfies</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabText}>Style Submissions: All</Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabText}>Outfits</Text>
        </TouchableOpacity>
      </View>

      {/* Posts Feed */}
      <ScrollView
        style={styles.feed}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {posts.map(renderPost)}
        
        {posts.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No posts yet</Text>
            <Text style={styles.emptyStateSubtext}>Follow some users to see their posts here</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.bottomNavItem}>
          <Ionicons name="apps" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem}>
          <Ionicons name="bookmark" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem}>
          <Ionicons name="diamond" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => setShowCommunityModal(true)}
        >
          <Ionicons name="people" size={24} color="#666" />
          <Text style={styles.bottomNavText}>Community</Text>
        </TouchableOpacity>
      </View>

      {/* Community Modal */}
      <CommunityModal
        visible={showCommunityModal}
        onClose={() => setShowCommunityModal(false)}
        currentUser={currentUser}
      />
    </View>
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
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  profileInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  percentageBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  percentageText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginLeft: 16,
  },
  navIcons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  navIcon: {
    alignItems: 'center',
  },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  wheelIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  readIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  navText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabNavigation: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1F2937',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 4,
  },
  activeTabText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  feed: {
    flex: 1,
  },
  postCard: {
    backgroundColor: '#fff',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  suggestion: {
    fontSize: 12,
    color: '#6B7280',
  },
  followButton: {
    backgroundColor: '#BFFF00',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: '#E5E7EB',
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  followingButtonText: {
    color: '#6B7280',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  colorPalette: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  spacer: {
    flex: 1,
  },
  tapToReact: {
    fontSize: 12,
    color: '#6B7280',
  },
  postDescription: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  bottomNavItem: {
    alignItems: 'center',
  },
  bottomNavText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
});
